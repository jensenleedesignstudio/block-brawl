import { test } from "node:test";
import assert from "node:assert/strict";
import { checkModelHealth, monitorModelHealth, type ModelHealth } from "../src/model-health";
import { POLICY_VERSION } from "../shared/learning";

const healthy = () => new Response(JSON.stringify({ ok: true, version: POLICY_VERSION }));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("a healthy startup response can take longer than the old 1.5-second limit", async () => {
    const fetcher: typeof fetch = (_url, options) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(healthy()), 1600);
        options?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
    });
    const result = await checkModelHealth("https://models.example", new AbortController().signal, undefined, fetcher);
    assert.equal(result.kind, "ready");
});

test("health requests bypass stale responses and reject incompatible model versions", async () => {
    let requested = "";
    let cache: RequestCache | undefined;
    const fetcher: typeof fetch = async (url, options) => {
        requested = String(url);
        cache = options?.cache;
        return new Response(JSON.stringify({ ok: true, version: POLICY_VERSION + 1 }));
    };
    const result = await checkModelHealth("https://models.example", new AbortController().signal, 100, fetcher);
    assert.equal(requested, "https://models.example/health");
    assert.equal(cache, "no-store");
    assert.equal(result.kind, "incompatible");
});

test("health failures distinguish server errors, network blocks, and timeouts", async () => {
    const signal = new AbortController().signal;
    const denied = await checkModelHealth("https://models.example", signal, 100, async () => new Response(null, { status: 403 }));
    assert.equal(denied.kind, "http");
    assert.match(denied.message, /not allowing this website/);
    const network = await checkModelHealth("https://models.example", signal, 100, async () => { throw new TypeError("Failed to fetch"); });
    assert.equal(network.kind, "network");
    const timeout = await checkModelHealth("https://models.example", signal, 5, (_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    assert.equal(timeout.kind, "timeout");
});

test("monitor never overlaps a slow request and stops updating after cleanup", async () => {
    const updates: ModelHealth[] = [];
    let calls = 0;
    let resolveRequest: (response: Response) => void = () => {};
    let requestSignal: AbortSignal | null | undefined;
    const stop = monitorModelHealth("https://models.example", (status) => updates.push(status), {
        retryMs: 1,
        timeoutMs: 1000,
        fetcher: (_url, options) => {
            calls++;
            requestSignal = options?.signal;
            return new Promise((resolve) => { resolveRequest = resolve; });
        }
    });
    await wait(20);
    assert.equal(calls, 1, "pending startup must not launch more requests");
    stop();
    assert.equal(requestSignal?.aborted, true);
    resolveRequest(healthy());
    await wait(10);
    assert.deepEqual(updates.map((status) => status.kind), ["connecting"]);
    assert.equal(calls, 1);
});

test("monitor retries after a failed request and unlocks when the model becomes ready", async () => {
    const updates: ModelHealth[] = [];
    let stop = () => {};
    let calls = 0;
    await new Promise<void>((resolve) => {
        stop = monitorModelHealth("https://models.example", (status) => {
            updates.push(status);
            if (status.kind === "ready") { stop(); resolve(); }
        }, {
            retryMs: 1,
            fetcher: async () => ++calls === 1 ? new Response(null, { status: 503 }) : healthy()
        });
    });
    assert.deepEqual(updates.map((status) => status.kind), ["connecting", "http", "ready"]);
    assert.equal(calls, 2);
});
