// ============================================================
// PIXEL ICON INTERFACE
// ============================================================

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

type IconName =
    | "sound"
    | "muted"
    | "settings"
    | "keyboard"
    | "camera"
    | "help"
    | "arrow"
    | "expand"
    | "pause"
    | "play"
    | "close"
    | "check"
    | "globe"
    | "shield"
    | "diagonal"
    | "target"
    | "copy"
    | "bolt";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const paths: Record<IconName, string> = {
    sound: "M2 9h4V7h2V5h3v14H8v-2H6v-2H2zM13 8h2v2h2v4h-2v2h-2v-2h2v-4h-2zM17 4h2v2h2v3h2v6h-2v3h-2v2h-2v-2h2v-3h2V9h-2V6h-2z",
    muted: "M2 9h4V7h2V5h3v14H8v-2H6v-2H2zM14 8h2v2h2V8h2v2h-2v4h2v2h-2v-2h-2v2h-2v-2h2v-4h-2z",
    settings:
        "M9 2h6v3h3V3h3v3h-2v3h3v6h-3v3h2v3h-3v-2h-3v3H9v-3H6v2H3v-3h2v-3H2V9h3V6H3V3h3v2h3zM9 9v6h6V9z",
    keyboard:
        "M2 5h20v14H2zM4 7v10h16V7zM6 8h2v2H6zM10 8h2v2h-2zM14 8h2v2h-2zM18 8h1v2h-1zM6 11h2v2H6zM10 11h2v2h-2zM14 11h2v2h-2zM18 11h1v2h-1zM7 14h11v2H7z",
    camera: "M7 2h10v2h3v11h-3v2h-4v3h5v2H6v-2h5v-3H7v-2H4V4h3zM8 6v7h8V6zM10 8h4v3h-4z",
    help: "M7 2h10v2h3v4h-3v3h-3v3h-4v-5h4V7h2V5H8v3H4V4h3zM10 17h4v4h-4z",
    arrow: "M12 3h3v3h3v3h3v6h-3v3h-3v3h-3v-7H2v-4h10z",
    expand: "M2 2h8v3H5v5H2zM14 2h8v8h-3V5h-5zM2 14h3v5h5v3H2zM19 14h3v8h-8v-3h5z",
    pause: "M5 3h5v18H5zM14 3h5v18h-5z",
    play: "M6 3h3v2h3v2h3v2h3v2h3v2h-3v2h-3v2h-3v2H9v2H6z",
    close: "M4 4h3v3h3v3h4V7h3V4h3v3h-3v3h-3v4h3v3h3v3h-3v-3h-3v-3h-4v3H7v3H4v-3h3v-3h3v-4H7V7H4z",
    check: "M3 11h3v3h3v3h3v-3h3v-3h3V8h3v3h-3v3h-3v3h-3v3H9v-3H6v-3H3z",
    globe: "M7 2h10v2h3v3h2v10h-2v3h-3v2H7v-2H4v-3H2V7h2V4h3zM7 5v4H5v5h4v5h5v-6h5V8h-5V5z",
    shield: "M3 3h18v11h-3v3h-3v3H9v-3H6v-3H3zM6 6v7h3v3h6v-3h3V6z",
    diagonal: "M8 3h13v13h-3V8h-3v3h-3v3H9v3H6v3H3v-3h3v-3h3v-3h3V8h3V6H8z",
    target: "M10 1h4v4h4v2h2v3h3v4h-3v3h-2v2h-4v4h-4v-4H6v-2H4v-3H1v-4h3V7h2V5h4zM8 8v8h8V8zM10 10h4v4h-4z",
    copy: "M3 2h13v3H6v12H3zM8 7h13v15H8zM11 10v9h7v-9z",
    bolt: "M12 1h7l-5 8h7L9 23H5l5-10H3z"
};

// ------------------------------------------------------------
// PIXEL ICON
// ------------------------------------------------------------

export function PixelIcon ({
    name,
    size = 20,
    className = ""
}: {
    name: IconName;
    size?: number;
    className?: string;
}) {
    return (
        <svg
            className={`pixel-icon ${className}`}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            shapeRendering="crispEdges"
            aria-hidden="true"
        >
            <path d={paths[name]} fill="currentColor" fillRule="evenodd" />
        </svg>
    );
}
