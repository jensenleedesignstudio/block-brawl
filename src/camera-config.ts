/** Vite settings are public. Accept ICE credentials, never a provider admin key. */
export function partyCameraConfiguration (configured?: string, relayOnly = false): RTCConfiguration {
    const servers: unknown = configured?.trim()
        ? JSON.parse(configured)
        : [{ urls: "stun:stun.l.google.com:19302" }];
    if (!Array.isArray(servers) || !servers.length)
        throw new Error("VITE_RTC_ICE_SERVERS must be a non-empty JSON array");
    let hasRelay = false;
    for (const server of servers) {
        if (!server || typeof server !== "object") throw new Error("Invalid ICE server");
        const urls = typeof server.urls === "string" ? [server.urls] : server.urls;
        if (
            !Array.isArray(urls) ||
            !urls.length ||
            urls.some(
                (url: unknown) =>
                    typeof url !== "string" || !/^(stun|stuns|turn|turns):[^\s]+$/.test(url)
            )
        )
            throw new Error("Each ICE server needs valid STUN or TURN URLs");
        if (urls.some((url: string) => /^turns?:/.test(url))) {
            hasRelay = true;
            if (
                typeof server.username !== "string" ||
                !server.username.trim() ||
                typeof server.credential !== "string" ||
                !server.credential.trim()
            )
                throw new Error("TURN servers require a username and credential");
        }
    }
    if (relayOnly && !hasRelay) throw new Error("Relay-only testing requires a TURN server");
    return { iceServers: servers, iceTransportPolicy: relayOnly ? "relay" : "all" };
}

/** Fetch provider-scoped or backend-issued credentials, with no browser cache. */
export async function loadPartyCameraConfiguration (
    configured: string | undefined,
    relayOnly: boolean,
    runtimeUrl: string | undefined,
    signal: AbortSignal,
    fetcher: typeof fetch = fetch
): Promise<RTCConfiguration> {
    if (!runtimeUrl?.trim()) return partyCameraConfiguration(configured, relayOnly);
    const url = new URL(runtimeUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
        throw new Error("Runtime ICE endpoint must use HTTPS without URL login credentials");
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    const timeout = setTimeout(cancel, 8000);
    try {
        const response = await fetcher(url.href, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load camera relay configuration");
        const servers: unknown = await response.json();
        // An explicitly configured relay service must not quietly degrade to STUN.
        const result = partyCameraConfiguration(JSON.stringify(servers), true);
        return { ...result, iceTransportPolicy: relayOnly ? "relay" : "all" };
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", cancel);
    }
}
