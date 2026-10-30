// ============================================================
// HAND MOVEMENT FOR KNOCKDOWN RECOVERY
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Landmark } from "./gestures";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export interface TrackedHand {
    landmarks: Landmark[];
    worldLandmarks: Landmark[];
    handedness: string;
    score: number;
    source?: string;
}

// ------------------------------------------------------------
// RECOVERY HANDS
// ------------------------------------------------------------

/** Pose wrists keep recovery usable when the detailed hand model loses a fist. */
export function recoveryHands (hands: TrackedHand[], pose: Landmark[]): TrackedHand[] {
    return ["Left", "Right"].flatMap((side, index) => {
        const wrist = pose[15 + index];

        if (
            wrist &&
            (wrist.visibility ?? 0) >= 0.55 &&
            Number.isFinite(wrist.y) &&
            wrist.y >= 0 &&
            wrist.y <= 1
        ) {
            return [
                {
                    landmarks: Array.from({ length: 21 }, () => wrist),
                    worldLandmarks: [],
                    handedness: side,
                    score: 1,
                    source: "wrist"
                }
            ];
        }

        const hand = hands.find((h) => h.handedness === side);

        return hand ? [{ ...hand, source: "hand" }] : [];
    });
}

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface HandTrack {
    source: string;
    y: number;
    seen: number;
    anchor: number;
    started: number;
    extreme: number;
    direction: number;
    counted: boolean;
    stillSince: number;
}

// ------------------------------------------------------------
// RECOVERY GESTURE DETECTOR
// ------------------------------------------------------------

/** Image Y increases downward. Each vertical leg counts once, regardless of palm orientation. */
export class RecoveryGestureDetector {
    private tracks = new Map<string, HandTrack>();
    private pending: { side: 0 | 1; time: number }[] = [];
    private lastEmit = -Infinity;
    private lastTime = -Infinity;
    reset () {
        this.tracks.clear();

        this.pending = [];

        this.lastEmit = -Infinity;

        this.lastTime = -Infinity;
    }
    update (
        hands: TrackedHand[],
        time: number,
        bodyWidth: number
    ): { side: 0 | 1 | null; message: string } {
        if (!Number.isFinite(time) || time <= this.lastTime)
            return { side: null, message: "Move either hand UP / DOWN." };

        this.lastTime = time;

        const scale = Number.isFinite(bodyWidth) ? Math.max(0.12, Math.min(0.6, bodyWidth)) : 0.2;

        const travelNeeded = Math.max(0.035, scale * 0.22),
            reversal = Math.max(0.015, scale * 0.07);

        let visible = 0;

        const seen = new Set<string>();

        for (const hand of hands) {
            const key = hand.handedness,
                p = hand.landmarks;

            if (!["Left", "Right"].includes(key) || seen.has(key) || p.length < 21) continue;

            const centers = [0, 5, 9, 17].map((i) => p[i]?.y);

            if (!centers.every((y) => Number.isFinite(y) && y >= 0 && y <= 1)) continue;

            seen.add(key);

            visible++;

            const rawY = centers.reduce((sum, y) => sum + y, 0) / 4;

            let track = this.tracks.get(key);

            if (!track || time - track.seen > 250 || track.source !== (hand.source ?? "hand")) {
                track = {
                    source: hand.source ?? "hand",
                    y: rawY,
                    seen: time,
                    anchor: rawY,
                    started: time,
                    extreme: rawY,
                    direction: 0,
                    counted: false,
                    stillSince: time
                };

                this.tracks.set(key, track);

                continue;
            }

            const dt = time - track.seen;

            const y = track.y + (rawY - track.y) * (1 - Math.exp(-dt / 25));

            track.y = y;

            track.seen = time;

            if (!track.direction) {
                if (Math.abs(y - track.anchor) < reversal) continue;

                track.direction = Math.sign(y - track.anchor);

                track.extreme = y;

                track.stillSince = time;
            } else if ((y - track.extreme) * track.direction < -reversal) {
                // A meaningful reversal arms the next stroke, not ordinary tracking jitter.
                track.anchor = track.extreme;

                track.started = time - dt;

                track.direction *= -1;

                track.extreme = y;

                track.counted = false;

                track.stillSince = time;
            } else if ((y - track.extreme) * track.direction > 0.004) {
                track.extreme = y;

                track.stillSince = time;
            }

            const travel = (y - track.anchor) * track.direction;

            const dramatic = travel >= travelNeeded;

            const pausedAtTop =
                track.direction === -1 &&
                travel >= Math.max(0.025, scale * 0.12) &&
                time - track.stillSince >= 120;

            if (!track.counted && (dramatic || pausedAtTop)) {
                track.counted = true;

                this.pending.push({ side: key === "Left" ? 0 : 1, time });
            }
        }

        for (const [key, track] of this.tracks)
            if (time - track.seen > 250) this.tracks.delete(key);

        this.pending = this.pending.filter((event) => time - event.time <= 350);

        let side: 0 | 1 | null = null;

        // Serialize simultaneous hand strokes so the shared combat rate limit accepts both.
        if (time - this.lastEmit >= 80 && this.pending.length) {
            side = this.pending.shift()!.side;

            this.lastEmit = time;
        }

        return {
            side,
            message:
                side !== null
                    ? "Movement +1 — keep pumping!"
                    : visible
                      ? "Move either hand UP / DOWN. A clear stroke or brief stop at the top counts once."
                      : "Keep either hand visible. Move it UP / DOWN; J / K also work."
        };
    }
}
