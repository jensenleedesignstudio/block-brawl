// ============================================================
// TRAINED OPPONENT SERVICE CONFIGURATION
// ============================================================

const HOSTED_MODEL = "https://block-brawl.onrender.com";
const MODEL_PROXY = "/api/opponent";

/** Public builds must use their hosted endpoint, never the visitor's loopback service. */
export function modelServiceUrl (pageUrl: string, configuredUrl?: string): string | null {
    const page = new URL(pageUrl);
    const configured = configuredUrl?.trim();

    if (configured) {
        try {
            const relative = configured.startsWith("/") && !configured.startsWith("//");
            const service = relative ? new URL(configured, page.origin) : new URL(configured);
            if (!["http:", "https:"].includes(service.protocol)) return null;
            if (page.protocol === "https:" && service.protocol !== "https:") return null;
            if (service.username || service.password || service.search || service.hash) return null;
            const endpoint = service.href.replace(/\/+$/, "");
            // This repository's Vercel rewrites forward the two AI endpoints.
            // Keep the browser on its own origin instead of contacting Render.
            if (page.hostname.endsWith(".vercel.app") && endpoint === HOSTED_MODEL)
                return `${page.origin}${MODEL_PROXY}`;
            return endpoint;
        } catch {
            return null;
        }
    }

    return ["localhost", "127.0.0.1", "[::1]"].includes(page.hostname)
        ? "http://127.0.0.1:8766"
        : null;
}
