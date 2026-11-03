import { test } from "node:test";
import assert from "node:assert/strict";
import { partyCameraConfiguration, loadPartyCameraConfiguration } from "../src/camera-config";

test("camera configuration retains provider transports and supports relay-only verification", () => {
    const servers = [
        {
            urls: ["turn:relay.example:3478", "turns:relay.example:443?transport=tcp"],
            username: "test",
            credential: "test-password"
        }
    ];
    assert.deepEqual(partyCameraConfiguration(JSON.stringify(servers), true), {
        iceServers: servers,
        iceTransportPolicy: "relay"
    });
    assert.equal(partyCameraConfiguration(JSON.stringify(servers)).iceTransportPolicy, "all");
    assert.equal(partyCameraConfiguration().iceTransportPolicy, "all");
});

test("runtime ICE credentials bypass caches and override static credentials", async () => {
    const servers = [
        { urls: "turns:relay.example:443", username: "temporary", credential: "temporary-password" }
    ];
    let requests = 0;
    const fetcher: typeof fetch = async (_url, options) => {
        assert.equal(options?.cache, "no-store");
        requests++;
        return Response.json(servers);
    };
    const signal = new AbortController().signal;
    const result = await loadPartyCameraConfiguration(
        "invalid static JSON",
        false,
        "https://relay.example/credentials",
        signal,
        fetcher
    );
    assert.deepEqual(result, { iceServers: servers, iceTransportPolicy: "all" });
    await loadPartyCameraConfiguration(
        undefined,
        true,
        "https://relay.example/credentials",
        signal,
        fetcher
    );
    assert.equal(requests, 2, "each request can obtain renewed credentials");
});

test("a configured runtime relay never silently falls back after HTTP, schema or permission errors", async () => {
    const signal = new AbortController().signal;
    for (const response of [
        new Response("Denied", { status: 403 }),
        Response.json([{ urls: "stun:relay.example" }]),
        Response.json({ invalid: true })
    ]) {
        await assert.rejects(
            loadPartyCameraConfiguration(
                undefined,
                false,
                "https://relay.example/ice",
                signal,
                async () => response
            )
        );
    }
    await assert.rejects(
        loadPartyCameraConfiguration(undefined, false, "http://relay.example/ice", signal),
        /HTTPS/
    );
    const abort = new AbortController();
    const request = loadPartyCameraConfiguration(
        undefined,
        false,
        "https://relay.example/ice",
        abort.signal,
        async (_url, options) =>
            new Promise((_resolve, reject) => {
                options?.signal?.addEventListener("abort", () => reject(new Error("Aborted")), {
                    once: true
                });
            })
    );
    abort.abort();
    await assert.rejects(request, /Aborted/);
});

test("camera configuration rejects invalid JSON, missing TURN credentials and relay tests without TURN", () => {
    for (const value of [
        "not JSON",
        "{}",
        "[]",
        "[null]",
        '[{"urls":"https://relay.example"}]',
        '[{"urls":"turn:relay.example"}]',
        '[{"urls":[123]}]'
    ])
        assert.throws(() => partyCameraConfiguration(value));
    assert.throws(() => partyCameraConfiguration(undefined, true), /requires a TURN server/);
});
