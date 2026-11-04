import { POLICY_VERSION } from "../shared/learning";

export type ModelHealth = {
    kind: "connecting" | "ready" | "timeout" | "network" | "http" | "incompatible";
    message: string;
};

export const CONNECTING_MODEL: ModelHealth = {
    kind: "connecting",
    message: "waking up your opponent… this may take a moment."
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
                message:
                    response.status === 403
                        ? "the opponent service is blocking this connection. retrying…"
                        : `The opponent service returned HTTP ${response.status}. Retrying…`
            };
        }
        const status = (await response.json()) as { ok?: boolean; version?: number };
        if (status?.ok !== true || status.version !== POLICY_VERSION) {
            return { kind: "incompatible", message: "your opponent needs an update. retrying…" };
        }
        return { kind: "ready", message: "" };
    } catch (error) {
        if (error instanceof SyntaxError) {
            return {
                kind: "incompatible",
                message: "your opponent sent an invalid response. retrying…"
            };
        }
        return controller.signal.aborted
            ? { kind: "timeout", message: "your opponent is still waking up. retrying…" }
            : {
                  kind: "network",
                  message:
                      "can’t reach your opponent. check your connection or browser blocking settings. retrying…"
              };
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
        const result = await checkModelHealth(
            url,
            controller.signal,
            options.timeoutMs,
            options.fetcher
        );
        if (!active) return;
        update(result);
        if (active)
            timer = setTimeout(() => {
                void check();
            }, options.retryMs ?? 5000);
    };
    void check();
    return () => {
        active = false;
        clearTimeout(timer);
        controller.abort();
    };
}
