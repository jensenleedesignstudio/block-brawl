import { POLICY_VERSION } from "../shared/learning";

export type ModelHealth = {
    kind: "connecting" | "ready" | "timeout" | "network" | "http" | "incompatible";
    message: string;
};

export const CONNECTING_MODEL: ModelHealth = {
    kind: "connecting",
    message: "Connecting to the trained opponent… The server may need time to wake up."
};

/** A startup probe needs a longer budget than an in-fight prediction. */
export async function checkModelHealth (
    url: string,
    signal: AbortSignal,
    timeoutMs = 60_000,
    fetcher: typeof fetch = fetch
): Promise<ModelHealth> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    const timeout = setTimeout(cancel, timeoutMs);
    try {
        const response = await fetcher(`${url}/health`, {
            signal: controller.signal,
            cache: "no-store"
        });
        if (!response.ok) {
            return {
                kind: "http",
                message: response.status === 403
                    ? "The opponent service is not allowing this website to connect. Retrying…"
                    : `The opponent service returned HTTP ${response.status}. Retrying…`
            };
        }
        const status = await response.json() as { ok?: boolean; version?: number };
        if (status?.ok !== true || status.version !== POLICY_VERSION) {
            return { kind: "incompatible", message: "The opponent service needs a compatible model update. Retrying…" };
        }
        return { kind: "ready", message: "" };
    } catch (error) {
        if (error instanceof SyntaxError) {
            return { kind: "incompatible", message: "The opponent service returned an invalid health response. Retrying…" };
        }
        return controller.signal.aborted
            ? { kind: "timeout", message: "The trained opponent is taking longer to start. Retrying…" }
            : { kind: "network", message: "Your browser could not reach the trained opponent. Check your connection or browser blocking settings. Retrying…" };
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
    }
}

/** Serialize probes so a slow wake-up is never interrupted by another poll. */
export function monitorModelHealth (
    url: string,
    update: (status: ModelHealth) => void,
    options: { timeoutMs?: number; retryMs?: number; fetcher?: typeof fetch } = {}
): () => void {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    update(CONNECTING_MODEL);
    const check = async () => {
        if (!active) return;
        const result = await checkModelHealth(url, controller.signal, options.timeoutMs, options.fetcher);
        if (!active) return;
        update(result);
        if (active) timer = setTimeout(() => { void check(); }, options.retryMs ?? 5000);
    };
    void check();
    return () => {
        active = false;
        clearTimeout(timer);
        controller.abort();
    };
}
