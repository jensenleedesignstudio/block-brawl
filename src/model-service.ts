// ============================================================
// TRAINED OPPONENT SERVICE CONFIGURATION
// ============================================================

/** Public builds must use their hosted endpoint, never the visitor's loopback service. */
export function modelServiceUrl (pageUrl: string, configuredUrl?: string): string | null {
    const page = new URL(pageUrl);
    const configured = configuredUrl?.trim();

    if (configured) {
        try {
            const service = new URL(configured);
            if (!["http:", "https:"].includes(service.protocol)) return null;
            if (page.protocol === "https:" && service.protocol !== "https:") return null;
            if (service.username || service.password || service.search || service.hash) return null;
            return service.href.replace(/\/+$/, "");
        } catch {
            return null;
        }
    }

    return ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname)
        ? "http://127.0.0.1:8766"
        : null;
}
