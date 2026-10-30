// ============================================================
// VISUAL SMOOTHING AND HIT RECOIL
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Match } from "../../shared/combat.js";

// ------------------------------------------------------------
// ARENA PRESENTATION
// ------------------------------------------------------------

/** Cosmetic smoothing only. Never writes back into authoritative combat state. */
export class ArenaPresentation {
    private previous: Match | null = null;
    reset () {
        this.previous = null;
    }
    frame (match: Match, elapsedMs: number): Match {
        const previous = this.previous;

        if (!previous || match.tick < previous.tick || match.phase !== previous.phase) {
            this.previous = {
                ...match,
                fighters: match.fighters.map((f) => ({ ...f })) as Match["fighters"]
            };

            return this.previous;
        }

        // A 35 ms response removes snapshot steps without a long camera trailing effect.
        const amount = 1 - Math.exp(-Math.min(100, Math.max(0, elapsedMs)) / 35);

        const blend = (a: number, b: number) => a + (b - a) * amount;

        const frame: Match = {
            ...match,
            orbit: blend(previous.orbit, match.orbit),
            ringX: blend(previous.ringX, match.ringX),
            ringY: blend(previous.ringY, match.ringY),
            fighters: match.fighters.map((f, i) => ({
                ...f,
                x: blend(previous.fighters[i].x, f.x)
            })) as Match["fighters"]
        };

        this.previous = frame;

        return frame;
    }
}

// ------------------------------------------------------------
// IMPACT RECOIL
// ------------------------------------------------------------

/** A short, decaying kick: identical for a given hit age at every display rate. */
export function impactRecoil (age: number): { x: number; y: number } {
    if (age < 0 || age >= 12) return { x: 0, y: 0 };

    const t = age / 12,
        envelope = (1 - t) * (1 - t);

    return { x: Math.sin(t * Math.PI * 3) * 4 * envelope, y: Math.sin(t * Math.PI) * 3 * envelope };
}
