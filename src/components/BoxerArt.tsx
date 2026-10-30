// ============================================================
// BOXER ART INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { CSSProperties } from "react";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export type BoxerPose = "guard" | "jab" | "hook" | "block" | "duck" | "uppercut";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const cells: Record<BoxerPose, [number, number]> = {
    guard: [0, 0],
    jab: [1, 0],
    hook: [2, 0],
    block: [0, 1],
    duck: [1, 1],
    uppercut: [2, 1]
};

// ------------------------------------------------------------
// BOXER ART
// ------------------------------------------------------------

/** Shared atlas keeps instructional illustrations consistent across the app. */
export function BoxerArt ({
    pose = "guard",
    className = ""
}: {
    pose?: BoxerPose;
    className?: string;
}) {
    const [column, row] = cells[pose];

    return (
        <span
            aria-hidden="true"
            className={`boxer-art ${className}`}
            style={
                {
                    backgroundPosition: `${column * 50}% ${row * 100}%`
                } as CSSProperties
            }
        />
    );
}

// ------------------------------------------------------------
// COMMAND POSE
// ------------------------------------------------------------

export function commandPose (key: string): BoxerPose {
    return (
        (
            { R: "uppercut", J: "jab", K: "jab", L: "hook", SPACE: "block", S: "duck" } as Record<
                string,
                BoxerPose
            >
        )[key] ?? "guard"
    );
}
