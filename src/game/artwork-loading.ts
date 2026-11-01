// Track current artwork separately from the combat simulation. Never reveal
// procedural fallback graphics while image downloads or material passes finish.
export type ArtworkStatus = "loading" | "ready" | "error";

interface Artwork {
    status: ArtworkStatus;
    start: () => void;
}

const artwork: Artwork[] = [];

export function loadArtwork (path: string, prepare: (image: HTMLImageElement) => void): void {
    if (typeof Image === "undefined") return;
    const image = new Image();
    const asset: Artwork = {
        status: "loading",
        start: () => {
            asset.status = "loading";
            image.src = path;
        }
    };
    image.onload = () => {
        try {
            prepare(image);
            asset.status = "ready";
        } catch {
            asset.status = "error";
        }
    };
    image.onerror = () => {
        asset.status = "error";
    };
    artwork.push(asset);
    asset.start();
}

export function artworkStatus (): ArtworkStatus {
    if (artwork.some((asset) => asset.status === "error")) return "error";
    return artwork.every((asset) => asset.status === "ready") ? "ready" : "loading";
}

export function retryArtwork (): void {
    for (const asset of artwork) {
        if (asset.status === "error") asset.start();
    }
}
