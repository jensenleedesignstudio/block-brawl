// ============================================================
// CAMERA GESTURES AND MOVEMENT DETECTION
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Action, Movement } from "../../shared/combat";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export interface Landmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}
interface Neutral {
    head: number;
    headX: number;
    shoulderX: number;
    width: number;
    torsoDepth: number;
}
export interface Detection {
    action: Action | null;
    block: boolean;
    movement: Movement;
    confidence: number;
    calibrated: boolean;
    progress: number;
    message: string;
}

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// The elbow must lie between shoulder and wrist, with an almost straight joint.
export const elbowAngle = (s: Landmark, e: Landmark, w: Landmark) => {
    const a = dist(s, e),
        b = dist(e, w),
        c = dist(s, w);

    return a < 0.01 || b < 0.01
        ? 0
        : (Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - c * c) / (2 * a * b)))) * 180) /
              Math.PI;
};

// ------------------------------------------------------------
// TOUCH GLOVES DETECTOR
// ------------------------------------------------------------

// A deliberate two-hand salute, held briefly, is distinct from a single punch.
export class TouchGlovesDetector {
    private since: number | null = null;
    private latched = false;
    progress = 0;
    message = "Raise both hands above shoulder level, or reach both hands forward.";
    reset () {
        this.since = null;

        this.latched = false;

        this.progress = 0;
    }
    update (p: Landmark[], time: number): boolean {
        if ([0, 11, 12, 15, 16].some((i) => !p[i] || (p[i].visibility ?? 0) < 0.35)) {
            this.since = null;

            this.progress = 0;

            this.message = "Bring both hands into view.";

            return false;
        }

        const width = Math.max(0.08, Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y));

        const forward = [0, 1].every((side) => {
            const s = p[11 + side],
                w = p[15 + side];

            return (s.z - w.z) / width > 0.2 && Math.abs(w.y - s.y) < width;
        });

        const raised = [15, 16].every((i) => p[i].y < p[0].y + width * 0.2);

        const touching =
            Math.abs(p[15].x - p[16].x) < width * 1.6 && Math.abs(p[15].y - p[16].y) < width * 0.65;

        if ((!forward && !raised) || !touching) {
            this.reset();

            this.message =
                "Raise both hands beside your head, or reach both hands toward the camera.";

            return false;
        }

        this.since ??= time;

        this.progress = Math.min(1, (time - this.since) / 600);

        this.message = "Both hands detected — hold to start!";

        if (!this.latched && time - this.since >= 600) {
            this.latched = true;

            return true;
        }

        return false;
    }
}

// ------------------------------------------------------------
// ULTIMATE GESTURE DETECTOR
// ------------------------------------------------------------

// A fast single-hand rise works even when its elbow cannot be measured.
export class UltimateGestureDetector {
    private samples: { time: number; heights: number[]; wrists: number[]; head: number }[] = [];
    private latched = false;
    reset () {
        this.samples = [];

        this.latched = false;
    }
    update (p: Landmark[], time: number): boolean {
        const visible = (i: number) =>
            !!p[i] &&
            (p[i].visibility ?? 0) >= 0.35 &&
            p[i].x >= 0 &&
            p[i].x <= 1 &&
            p[i].y >= 0 &&
            p[i].y <= 1;

        if (![0, 11, 12, 15, 16].every(visible)) {
            this.samples = [];

            return false;
        }

        const width = Math.max(0.08, Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y));

        const heights = [15, 16].map((i) => (p[0].y - p[i].y) / width);

        const shoulderY = (p[11].y + p[12].y) / 2;

        const wrists = [15, 16].map((i) => (shoulderY - p[i].y) / width),
            head = (shoulderY - p[0].y) / width;

        if (heights.every((h) => h < -0.15)) this.latched = false;

        this.samples = this.samples.filter((s) => time - s.time <= 350 && time > s.time);

        const raised = heights.map((h) => h > 0.2);

        const side = raised[0] && !raised[1] ? 0 : raised[1] && !raised[0] ? 1 : -1;

        const rapid =
            side >= 0 &&
            this.samples.some(
                (s) =>
                    time - s.time >= 25 &&
                    wrists[side] - s.wrists[side] > 0.5 &&
                    (wrists[side] - s.wrists[side]) / ((time - s.time) / 1000) > 2 &&
                    Math.abs(head - s.head) < 0.25 &&
                    Math.abs(wrists[1 - side] - s.wrists[1 - side]) < 0.35
            );

        const triggered = !this.latched && side >= 0 && heights[1 - side] < 0.15 && rapid;

        this.samples.push({ time, heights, wrists, head });

        if (triggered) {
            this.latched = true;

            this.samples = [];
        }

        return triggered;
    }
}

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface HookSample {
    time: number;
    x: number;
    y: number;
    z: number;
    angle: number;
    source: string;
}

// ------------------------------------------------------------
// RIGHT HOOK DETECTOR
// ------------------------------------------------------------

/** Right fist sweeps inward across the body; shoulder-relative travel rejects leaning. */
export class RightHookDetector {
    private samples: HookSample[] = [];
    private latched = false;
    private peak = -Infinity;
    reset () {
        this.samples = [];

        this.latched = false;

        this.peak = -Infinity;
    }
    update (p: Landmark[], time: number, world: Landmark[] = []): boolean {
        const ids = [11, 12, 14, 16];

        if (
            ids.some(
                (i) =>
                    !p[i] ||
                    (p[i].visibility ?? 0) < 0.35 ||
                    ![p[i].x, p[i].y, p[i].z].every(Number.isFinite)
            )
        ) {
            this.reset();

            return false;
        }

        const last = this.samples.at(-1);

        if (last && time <= last.time) return false;

        if (last && time - last.time > 250) this.reset();

        const width = Math.max(0.08, Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y));

        const facing = Math.sign(p[11].x - p[12].x) || 1;

        const useWorld = [12, 14, 16].every((i) => world[i] && (world[i].visibility ?? 1) >= 0.35);

        const g = useWorld ? world : p;

        const current: HookSample = {
            time,
            x: ((p[16].x - p[12].x) * facing) / width,
            y: (p[16].y - p[12].y) / width,
            z: (p[16].z - p[12].z) / width,
            angle: elbowAngle(g[12], g[14], g[16]),
            source: useWorld ? "world" : "image"
        };

        if (last && last.source !== current.source) this.reset();

        this.samples = this.samples.filter((s) => time - s.time <= 240);

        if (this.latched) {
            this.peak = Math.max(this.peak, current.x);

            if (this.peak - current.x >= 0.22) {
                this.latched = false;

                this.samples = [];
            }

            this.samples.push(current);

            return false;
        }

        const hook =
            current.angle >= 35 &&
            current.angle <= 145 &&
            Math.abs(current.y) < 1.4 &&
            this.samples.some((s) => {
                const dt = (time - s.time) / 1000,
                    dx = current.x - s.x;

                return (
                    dt >= 0.025 &&
                    dx >= 0.28 &&
                    dx / dt >= 1.5 &&
                    Math.abs(current.y - s.y) < 0.3 &&
                    dx > Math.abs(current.y - s.y) * 1.5 &&
                    dx > Math.abs(current.z - s.z) * 0.85 &&
                    s.angle <= 150 &&
                    current.angle - s.angle < 25
                );
            });

        this.samples.push(current);

        if (hook) {
            this.latched = true;

            this.peak = current.x;
        }

        return hook;
    }
}

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface PunchSample {
    time: number;
    angle: number;
    reach: number;
}

// ------------------------------------------------------------
// PUNCH MOTION DETECTOR
// ------------------------------------------------------------

// Short motion history recognizes extension before lockout. One event per stroke.
class PunchMotionDetector {
    private samples: PunchSample[] = [];
    private source = "";
    private latched = false;
    private peak = 0;
    reset () {
        this.samples = [];

        this.source = "";

        this.latched = false;

        this.peak = 0;
    }
    update (p: Landmark[], world: Landmark[], side: number, time: number): boolean {
        const ids = [11 + side, 13 + side, 15 + side];

        if (ids.some((i) => !p[i] || (p[i].visibility ?? 0) < 0.35)) {
            this.reset();

            return false;
        }

        const useWorld = ids.every((i) => world[i] && (world[i].visibility ?? 1) >= 0.35);

        const source = useWorld ? "world" : "image",
            g = useWorld ? world : p;

        const [s, e, w] = ids.map((i) => g[i]);

        const angle = elbowAngle(s, e, w),
            length = dist(s, e) + dist(e, w),
            reach = dist(s, w) / length;

        if (!Number.isFinite(angle) || !Number.isFinite(reach) || length < 0.02) {
            this.reset();

            return false;
        }

        const last = this.samples.at(-1);

        if (last && time <= last.time) return false;

        if (source !== this.source || (last && time - last.time > 200)) {
            this.reset();

            this.source = source;
        }

        this.samples = this.samples.filter((sample) => time - sample.time <= 180);

        this.peak = Math.max(this.peak, angle);

        if (this.latched && this.peak - angle >= 25) {
            this.latched = false;

            this.peak = angle;

            this.samples = [];
        }

        const extending =
            !this.latched &&
            angle >= 95 &&
            this.samples.some((sample) => {
                const dt = (time - sample.time) / 1000;

                return (
                    dt >= 0.02 &&
                    angle - sample.angle >= 14 &&
                    reach - sample.reach >= 0.06 &&
                    (angle - sample.angle) / dt >= 100
                );
            });

        this.samples.push({ time, angle, reach });

        if (extending) {
            this.latched = true;

            this.peak = angle;
        }

        return extending;
    }
}

// ------------------------------------------------------------
// GESTURE DETECTOR
// ------------------------------------------------------------

export class GestureDetector {
    private ultimate = new UltimateGestureDetector();
    private hook = new RightHookDetector();
    private punches = [new PunchMotionDetector(), new PunchMotionDetector()];
    private smooth: Landmark[] = [];
    private previous: Landmark[] = [];
    private neutral: Neutral | null = null;
    private samples: Neutral[] = [];
    private calibrating = true;
    private lastTime = 0;
    private cooldown = 0;
    private guardFrames = 0;
    private defenseFrames = 0;
    private lastDefense = "";
    calibrate () {
        this.ultimate.reset();

        this.hook.reset();

        this.samples = [];

        this.neutral = null;

        this.calibrating = true;

        this.smooth = [];

        this.previous = [];

        this.punches.forEach((punch) => punch.reset());

        this.lastTime = 0;

        this.cooldown = 0;

        this.guardFrames = 0;

        this.defenseFrames = 0;

        this.lastDefense = "";
    }
    update (points: Landmark[], time: number, world: Landmark[] = []): Detection {
        // Hidden hips or the non-punching hand must not disable a visible arm.
        const confidence = Math.min(...[0, 11, 12].map((i) => points[i]?.visibility ?? 0));

        const result: Detection = {
            action: null,
            block: false,
            movement: 0,
            confidence,
            calibrated: !!this.neutral,
            progress: this.samples.length / 40,
            message: "Keep your head and both shoulders visible."
        };

        if (confidence < 0.5 || points.length < 25) {
            this.ultimate.reset();

            this.hook.reset();

            this.guardFrames = 0;

            this.defenseFrames = 0;

            this.lastDefense = "";

            this.punches.forEach((punch) => punch.reset());

            this.smooth = [];

            this.previous = [];

            this.lastTime = 0;

            if (this.calibrating) this.samples = [];

            return result;
        }

        this.previous = this.smooth;

        this.smooth = points.map((p, i) => ({
            x: (this.previous[i]?.x ?? p.x) * 0.4 + p.x * 0.6,
            y: (this.previous[i]?.y ?? p.y) * 0.4 + p.y * 0.6,
            z: (this.previous[i]?.z ?? p.z) * 0.4 + p.z * 0.6,
            visibility: p.visibility
        }));

        const p = this.smooth,
            width = Math.max(0.08, Math.hypot(p[11].x - p[12].x, p[11].y - p[12].y));

        const shoulders = (p[11].x + p[12].x) / 2;

        const hipsVisible = [23, 24].every((i) => (p[i]?.visibility ?? 0) >= 0.5);

        const torsoDepth = hipsVisible
            ? (p[11].z + p[12].z - p[23].z - p[24].z) / 2 / width
            : (this.neutral?.torsoDepth ?? 0);

        const hookMotion = this.hook.update(points, time, world);

        const punchMotion = this.punches.map((punch, side) =>
            punch.update(points, world, side, time)
        );

        if (this.calibrating) {
            this.samples.push({
                head: p[0].y,
                headX: p[0].x,
                shoulderX: shoulders,
                width,
                torsoDepth
            });

            if (this.samples.length >= 40) {
                this.neutral = {
                    head: this.samples.reduce((a, b) => a + b.head, 0) / 40,
                    headX: this.samples.reduce((a, b) => a + b.headX, 0) / 40,
                    shoulderX: this.samples.reduce((a, b) => a + b.shoulderX, 0) / 40,
                    width: this.samples.reduce((a, b) => a + b.width, 0) / 40,
                    torsoDepth: this.samples.reduce((a, b) => a + b.torsoDepth, 0) / 40
                };

                this.calibrating = false;
            }

            result.progress = Math.min(1, this.samples.length / 40);

            result.calibrated = !!this.neutral;

            result.message = this.neutral
                ? "Ready! Drive either fist forward to punch, then return to guard."
                : "Calibrating automatically: hold your guard and keep your head, hands, and hips in view.";

            this.lastTime = time;

            return result;
        }

        if (!this.neutral) {
            result.message = "Raise your hands into guard, then calibrate.";

            this.lastTime = time;

            return result;
        }

        const dt = Math.max(0.025, Math.min(0.15, (time - this.lastTime) / 1000));

        this.lastTime = time;

        const guarded = [15, 16].every(
            (i) =>
                (p[i].visibility ?? 0) >= 0.35 &&
                p[i].y < p[0].y + width * 0.65 &&
                Math.abs(p[i].x - p[0].x) < width * 0.85
        );

        this.guardFrames = guarded ? this.guardFrames + 1 : 0;

        result.block = this.guardFrames >= 3;

        result.message = result.block
            ? "Guard detected • move head and shoulders together to slip"
            : "Tracking active • drive either fist forward to punch";

        const duck = (p[0].y - this.neutral.head) / this.neutral.width > 0.48;

        const shift = (shoulders - this.neutral.shoulderX) / this.neutral.width;

        const headShift = (p[0].x - this.neutral.headX) / this.neutral.width;

        const old = this.previous;

        const headSpeed = old.length >= 25 ? (p[0].x - old[0].x) / this.neutral.width / dt : 0;

        const shoulderSpeed =
            old.length >= 25
                ? (shoulders - (old[11].x + old[12].x) / 2) / this.neutral.width / dt
                : 0;

        // Raw camera x increases toward the user's left in our mirrored preview.
        const together =
            Math.abs(headSpeed) > 0.12 &&
            Math.abs(shoulderSpeed) > 0.12 &&
            Math.sign(headSpeed) === Math.sign(shoulderSpeed) &&
            Math.sign(headSpeed) === Math.sign(shift);

        // Shoulder depth catches a torso lean; apparent shoulder size catches a
        // step toward or away from the lens. Ignore short frame-to-frame jitter.
        const distance = width / this.neutral.width;

        const bodyDepth = torsoDepth - this.neutral.torsoDepth;

        if (distance > 1.13 || bodyDepth < -0.18) result.movement = 1;
        else if (distance < 0.87 || bodyDepth > 0.18) result.movement = -1;

        if (result.movement)
            result.message =
                result.movement === 1
                    ? "Moving forward • close the distance"
                    : "Moving back • make some space";

        const defense = duck
            ? "duck"
            : together && shift > 0.25 && headShift > 0.25
              ? "dodgeLeft"
              : together && shift < -0.25 && headShift < -0.25
                ? "dodgeRight"
                : "";

        this.defenseFrames = defense === this.lastDefense ? this.defenseFrames + 1 : 1;

        this.lastDefense = defense;

        const ultimate = this.ultimate.update(points, time);

        if (ultimate) {
            result.action = "ultimate";

            result.block = false;

            this.guardFrames = 0;

            this.cooldown = time + 900;

            result.message = "Rising Breaker! Lower your hand to reset.";

            return result;
        }

        if (hookMotion) {
            result.action = "hook";

            result.block = false;

            this.guardFrames = 0;

            this.cooldown = time + 240;

            result.message = "Right hook! Bring your fist back to guard.";

            return result;
        }

        if (time < this.cooldown) return result;

        if (defense && this.defenseFrames === 2) {
            result.action = defense;

            result.block = false;

            this.guardFrames = 0;

            this.cooldown = time + 650;

            return result;
        }

        if (this.previous.length < 25) return result;

        for (let side = 0; side < 2; side++) {
            if (punchMotion[side]) {
                result.action = side === 0 ? "jab" : "cross";

                this.cooldown = time + 180;

                result.block = false;

                this.guardFrames = 0;

                break;
            }
        }

        return result;
    }
}
