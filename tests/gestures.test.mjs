// ============================================================
// GESTURES REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { createMatch, act, setInputMode } from "../.test-build/shared/combat.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    GestureDetector,
    TouchGlovesDetector,
    UltimateGestureDetector,
    RightHookDetector
} from "../.test-build/src/motion/gestures.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const pose = () => {
    const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));

    Object.assign(p[0], { x: 0.5, y: 0.2 });

    Object.assign(p[11], { x: 0.6, y: 0.4 });

    Object.assign(p[12], { x: 0.4, y: 0.4 });

    Object.assign(p[13], { x: 0.64, y: 0.48 });

    Object.assign(p[14], { x: 0.36, y: 0.48 });

    Object.assign(p[15], { x: 0.6, y: 0.3 });

    Object.assign(p[16], { x: 0.4, y: 0.3 });

    Object.assign(p[23], { x: 0.57, y: 0.7 });

    Object.assign(p[24], { x: 0.43, y: 0.7 });

    return p;
};
const calibrated = () => {
    const d = new GestureDetector();

    d.calibrate();

    let r;

    for (let i = 0; i < 40; i++) r = d.update(pose(), i * 66);

    assert.equal(r.calibrated, true);

    return d;
};
const atAngle = (degrees, side = 0) => {
    const world = pose(),
        r = ((180 - degrees) * Math.PI) / 180;

    world[11 + side] = { x: 0, y: 0, z: 0, visibility: 0.99 };

    world[13 + side] = { x: 0.2, y: 0, z: 0, visibility: 0.99 };

    world[15 + side] = { x: 0.2 + 0.2 * Math.cos(r), y: 0.2 * Math.sin(r), z: 0, visibility: 0.99 };

    return world;
};
test("punch triggers during extension below 130 degrees at 15, 30 and 60 fps", () => {
    for (const side of [0, 1])
        for (const fps of [15, 30, 60]) {
            const d = calibrated();

            const dt = 1000 / fps;

            let fired = false;

            for (let i = 0; i <= Math.ceil(100 / dt); i++) {
                const angle = 70 + Math.min(40, i * dt * 0.4),
                    r = d.update(pose(), 2700 + i * dt, atAngle(angle, side));

                if (r.action) {
                    assert.equal(r.action, side === 0 ? "jab" : "cross");

                    assert.ok(angle <= 110);

                    assert.equal(fired, false);

                    fired = true;
                }
            }

            assert.ok(fired);

            for (let t = 2900; t <= 3400; t += 33)
                assert.equal(d.update(pose(), t, atAngle(110, side)).action, null);

            d.update(pose(), 3433, atAngle(70, side));

            assert.equal(
                d.update(pose(), 3499, atAngle(110, side)).action,
                side === 0 ? "jab" : "cross"
            );
        }
});
test("static extension, small angle jitter and slow stretches do not punch", () => {
    for (const kind of ["static", "jitter", "slow"]) {
        const d = calibrated();

        for (let i = 0; i < 40; i++) {
            const angle =
                kind === "static" ? 160 : kind === "jitter" ? 110 + (i % 2 ? 3 : 0) : 70 + i * 2;

            assert.equal(d.update(pose(), 2700 + i * 50, atAngle(angle)).action, null);
        }
    }
});
test("tracking loss and world/image source changes require fresh extension history", () => {
    const d = calibrated();

    d.update(pose(), 2700, atAngle(70));

    d.update([], 2733);

    assert.equal(d.update(pose(), 2800, atAngle(160)).action, null);

    assert.equal(d.update(pose(), 2833).action, null);

    assert.equal(d.update(pose(), 2866, atAngle(160)).action, null);
});
const glovePose = () => {
    const p = pose();

    p[13] = { x: 0.57, y: 0.38, z: -0.1, visibility: 0.99 };

    p[15] = { x: 0.54, y: 0.36, z: -0.2, visibility: 0.99 };

    p[14] = { x: 0.43, y: 0.38, z: -0.1, visibility: 0.99 };

    p[16] = { x: 0.46, y: 0.36, z: -0.2, visibility: 0.99 };

    return p;
};
test("touch gloves requires a hold, fires once, and resets after release", () => {
    const d = new TouchGlovesDetector(),
        p = glovePose();

    assert.equal(d.update(p, 0), false);

    assert.equal(d.update(p, 599), false);

    assert.equal(d.update(p, 600), true);

    assert.equal(d.update(p, 1500), false);

    d.update(pose(), 1600);

    assert.equal(d.update(p, 1700), false);

    assert.equal(d.update(p, 2300), true);
});
test("one extended fist and a normal guard cannot start a fight", () => {
    for (const p of [pose(), glovePose()]) {
        p[14] = pose()[14];

        p[16] = pose()[16];

        const d = new TouchGlovesDetector();

        for (let i = 0; i < 30; i++) assert.equal(d.update(p, i * 66), false);
    }
});
test("touch gloves rejects low confidence and restarts the hold after tracking loss", () => {
    const d = new TouchGlovesDetector(),
        p = glovePose();

    d.update(p, 0);

    d.update([], 500);

    assert.equal(d.update(p, 600), false);

    assert.equal(d.update(p, 1200), true);

    const hidden = glovePose();

    hidden[15].visibility = 0.1;

    const other = new TouchGlovesDetector();

    assert.equal(other.update(hidden, 0), false);

    assert.equal(other.update(hidden, 1000), false);
});
test("two sideways straight arms do not count as touching gloves", () => {
    const d = new TouchGlovesDetector(),
        p = glovePose();

    for (const i of [13, 14, 15, 16]) p[i].z = 0;

    for (let i = 0; i < 30; i++) assert.equal(d.update(p, i * 66), false);
});
test("calibrates automatically after a stable visible pose", () => {
    const d = new GestureDetector();

    let r;

    for (let i = 0; i < 40; i++) r = d.update(pose(), i * 66);

    assert.equal(r.calibrated, true);

    assert.equal(r.progress, 1);
});
test("requires visible shoulders to calibrate", () => {
    const d = new GestureDetector();

    d.calibrate();

    const p = pose();

    p[11].visibility = 0.1;

    for (let i = 0; i < 50; i++) assert.equal(d.update(p, i * 66).calibrated, false);
});
test("hips and opposite hand out of frame do not disable a visible punch", () => {
    const d = new GestureDetector(),
        p = pose();

    for (const i of [14, 16, 23, 24]) p[i].visibility = 0.1;

    let r;

    for (let i = 0; i < 40; i++) r = d.update(p, i * 66);

    assert.equal(r.calibrated, true);

    p[13] = { x: 0.76, y: 0.4, z: 0, visibility: 0.7 };

    p[15] = { x: 0.91, y: 0.4, z: 0, visibility: 0.4 };

    const actions = [];

    for (let i = 0; i < 15; i++) {
        r = d.update(p, 2700 + i * 33);

        if (r.action) actions.push(r.action);
    }

    assert.deepEqual(actions, ["jab"]);
});
test("raised hands start without forward depth or straight elbows", () => {
    const d = new TouchGlovesDetector(),
        p = pose();

    p[15].y = 0.2;

    p[16].y = 0.2;

    assert.equal(d.update(p, 0), false);

    assert.equal(d.update(p, 600), true);
});
test("world landmarks recognize a foreshortened arm pointed at the lens", () => {
    const d = calibrated(),
        p = pose(),
        world = pose();

    world[11] = { x: 0.2, y: 0, z: 0, visibility: 0.9 };

    world[13] = { x: 0.2, y: 0, z: -0.25, visibility: 0.9 };

    world[15] = { x: 0.2, y: 0, z: -0.5, visibility: 0.9 };

    d.update(p, 2634, atAngle(70));

    const actions = [];

    for (let i = 0; i < 15; i++) {
        const r = d.update(p, 2700 + i * 33, world);

        if (r.action) actions.push(r.action);
    }

    assert.deepEqual(actions, ["jab"]);
});
test("both hands held near face debounce to a block", () => {
    const d = calibrated();

    assert.equal(d.update(pose(), 2700).block, false);

    assert.equal(d.update(pose(), 2766).block, false);

    assert.equal(d.update(pose(), 2832).block, true);
});
test("tracking loss releases block and suppresses gestures", () => {
    const d = calibrated();

    for (let i = 0; i < 5; i++) d.update(pose(), 2700 + i * 66);

    const r = d.update([], 3100);

    assert.equal(r.block, false);

    assert.equal(r.action, null);

    assert.equal(r.confidence, 0);
});
test("head movement alone does not dodge", () => {
    const d = calibrated(),
        p = pose();

    p[0].x = 0.68;

    for (let i = 0; i < 15; i++) assert.equal(d.update(p, 2700 + i * 66).action, null);
});
test("shoulder movement alone does not dodge", () => {
    const d = calibrated(),
        p = pose();

    p[11].x += 0.13;

    p[12].x += 0.13;

    for (let i = 0; i < 15; i++) assert.equal(d.update(p, 2700 + i * 66).action, null);
});
test("head and shoulders moving together trigger one slip in either direction", () => {
    for (const sign of [-1, 1]) {
        const d = calibrated(),
            p = pose();

        for (const i of [0, 11, 12]) p[i].x += sign * 0.13;

        const actions = [];

        for (let i = 0; i < 15; i++) {
            const r = d.update(p, 2700 + i * 66);

            if (r.action) actions.push(r.action);
        }

        assert.deepEqual(actions, [sign === 1 ? "dodgeLeft" : "dodgeRight"]);
    }
});
test("head and shoulders moving in opposite directions do not slip", () => {
    const d = calibrated(),
        p = pose();

    p[0].x -= 0.13;

    p[11].x += 0.13;

    p[12].x += 0.13;

    for (let i = 0; i < 15; i++) assert.equal(d.update(p, 2700 + i * 66).action, null);
});
test("a coordinated slip with guard held releases block", () => {
    const d = calibrated();

    for (let i = 0; i < 3; i++) d.update(pose(), 2700 + i * 66);

    const p = pose();

    for (const i of [0, 11, 12]) p[i].x += 0.13;

    const actions = [];

    for (let i = 0; i < 5; i++) {
        const r = d.update(p, 2900 + i * 66);

        if (r.action) actions.push(r);
    }

    assert.deepEqual(
        actions.map((r) => r.action),
        ["dodgeLeft"]
    );

    assert.equal(actions[0].block, false);
});
test("lowering the body produces duck", () => {
    const d = calibrated(),
        p = pose();

    p[0].y = 0.35;

    const actions = [];

    for (let i = 0; i < 10; i++) {
        const r = d.update(p, 2700 + i * 66);

        if (r.action) actions.push(r.action);
    }

    assert.deepEqual(actions, ["duck"]);
});
test("straightening either arm in the image plane punches once and rearms on bending", () => {
    for (const side of [0, 1]) {
        const d = calibrated(),
            p = pose(),
            s = 11 + side,
            e = 13 + side,
            w = 15 + side,
            sign = side === 0 ? 1 : -1;

        p[e] = { x: p[s].x + sign * 0.16, y: 0.4, z: 0, visibility: 0.99 };

        p[w] = { x: p[s].x + sign * 0.31, y: 0.4, z: 0, visibility: 0.99 };

        const actions = [];

        for (let i = 0; i < 15; i++) {
            const r = d.update(p, 2700 + i * 66);

            if (r.action) actions.push(r.action);
        }

        for (let i = 0; i < 8; i++) d.update(pose(), 3700 + i * 66);

        for (let i = 0; i < 10; i++) {
            const r = d.update(p, 4300 + i * 66);

            if (r.action) actions.push(r.action);
        }

        assert.deepEqual(actions, side === 0 ? ["jab", "jab"] : ["cross", "cross"]);
    }
});
test("right hand pushed toward the lens recognizes cross", () => {
    const d = calibrated(),
        p = pose();

    d.update(pose(), 2700);

    p[16] = { x: 0.4, y: 0.31, z: -0.16, visibility: 0.99 };

    p[14] = { x: 0.4, y: 0.35, z: -0.08, visibility: 0.99 };

    const actions = [];

    for (let i = 0; i < 10; i++) {
        const r = d.update(p, 2766 + i * 66);

        if (r.action) actions.push(r.action);
    }

    assert.deepEqual(actions, ["cross"]);
});
test("forward depth recognizes a punch aimed toward the camera", () => {
    const d = calibrated(),
        p = pose();

    d.update(pose(), 2700);

    p[15] = { x: 0.6, y: 0.31, z: -0.16, visibility: 0.99 };

    p[13] = { x: 0.6, y: 0.35, z: -0.08, visibility: 0.99 };

    const actions = [];

    for (let i = 0; i < 10; i++) {
        const r = d.update(p, 2766 + i * 66);

        if (r.action) actions.push(r.action);
    }

    assert.deepEqual(actions, ["jab"]);
});
test("a bent arm pushed toward the lens does not count as a straight punch", () => {
    const d = calibrated(),
        p = pose();

    d.update(pose(), 2700);

    p[15] = { x: 0.53, y: 0.34, z: -0.18, visibility: 0.99 };

    p[13] = { x: 0.68, y: 0.42, z: -0.07, visibility: 0.99 };

    for (let i = 0; i < 10; i++) assert.equal(d.update(p, 2766 + i * 66).action, null);
});
test("matching elbow and wrist height with a bent joint does not punch", () => {
    const d = calibrated(),
        p = pose();

    p[13] = { x: 0.7, y: 0.4, z: 0, visibility: 0.99 };

    p[15] = { x: 0.6, y: 0.4, z: -0.15, visibility: 0.99 };

    for (let i = 0; i < 10; i++) assert.equal(d.update(p, 2700 + i * 66).action, null);
});
test("body-relative detection is invariant to camera framing scale", () => {
    for (const scale of [0.7, 1, 1.3]) {
        const transform = (p) =>
            p.map((q) => ({
                ...q,
                x: 0.5 + (q.x - 0.5) * scale,
                y: 0.5 + (q.y - 0.5) * scale,
                z: q.z * scale
            }));

        const d = new GestureDetector();

        d.calibrate();

        for (let i = 0; i < 40; i++) d.update(transform(pose()), i * 66);

        const p = pose();

        for (const i of [0, 11, 12]) p[i].x += 0.13;

        const actions = [];

        for (let i = 0; i < 15; i++) {
            const r = d.update(transform(p), 2700 + i * 66);

            if (r.action) actions.push(r.action);
        }

        assert.deepEqual(actions, ["dodgeLeft"]);
    }
});
test("moving toward and away from the lens changes movement and returns to neutral", () => {
    const d = calibrated();

    const forward = pose();

    for (const i of [11, 12]) forward[i].z = -0.07;

    let r;

    for (let i = 0; i < 4; i++) r = d.update(forward, 2700 + i * 66);

    assert.equal(r.movement, 1);

    const back = pose();

    for (const i of [11, 12]) back[i].z = 0.07;

    for (let i = 0; i < 8; i++) r = d.update(back, 3000 + i * 66);

    assert.equal(r.movement, -1);

    for (let i = 0; i < 8; i++) r = d.update(pose(), 3600 + i * 66);

    assert.equal(r.movement, 0);

    assert.equal(d.update([], 4200).movement, 0);
});

const raisedUltimate = (side = 0) => {
    const p = pose();

    p[15 + side].y = 0.1;

    p[13 + side].visibility = 0.1;

    return p;
};
test("rapid one-hand raise with hidden elbow triggers ultimate for either hand", () => {
    for (const side of [0, 1]) {
        const d = calibrated();

        d.update(pose(), 2700);

        const r = d.update(raisedUltimate(side), 2800);

        assert.equal(r.action, "ultimate");

        assert.equal(r.block, false);
    }
});
test("ultimate gesture rejects slow raises, two raised hands and unknown opposite hand", () => {
    const slow = new UltimateGestureDetector();

    for (let i = 0; i < 20; i++) {
        const p = raisedUltimate();

        p[15].y = 0.3 - i * 0.01;

        assert.equal(slow.update(p, i * 100), false);
    }

    for (const variant of ["both", "opposite"]) {
        const d = new UltimateGestureDetector();

        d.update(pose(), 0);

        const p = raisedUltimate();

        if (variant === "both") p[16].y = 0.1;

        if (variant === "elbow") p[13].visibility = 0.99;

        if (variant === "opposite") p[16].visibility = 0.1;

        assert.equal(d.update(p, 100), false);
    }
});
test("ultimate gesture latches until hands lower and requires fresh motion after tracking loss", () => {
    const d = new UltimateGestureDetector();

    d.update(pose(), 0);

    assert.ok(d.update(raisedUltimate(), 100));

    assert.equal(d.update(raisedUltimate(), 1100), false);

    d.update(pose(), 1200);

    assert.ok(d.update(raisedUltimate(), 1300));

    d.reset();

    d.update(pose(), 1400);

    d.update([], 1450);

    assert.equal(d.update(raisedUltimate(), 1500), false);
});
test("ultimate detects an elbow outside the camera frame and scales with body size", () => {
    for (const scale of [0.7, 1, 1.3]) {
        const transform = (p) =>
            p.map((q) => ({
                ...q,
                x: 0.5 + (q.x - 0.5) * scale,
                y: 0.5 + (q.y - 0.5) * scale,
                z: q.z * scale
            }));

        const d = new UltimateGestureDetector();

        d.update(transform(pose()), 0);

        const p = transform(raisedUltimate());

        p[13].visibility = 0.99;

        p[13].x = 1.1;

        // Keep the raised wrist within the frame for the closest camera framing.
        p[15].y = Math.max(0.01, p[15].y);

        assert.ok(d.update(p, 100));
    }
});

test("ultimate works with a visible elbow and is not swallowed by punch cooldown", () => {
    const d = calibrated(),
        p = pose(),
        world = pose();

    world[11] = { x: 0, y: 0, z: 0, visibility: 0.99 };

    world[13] = { x: 0.2, y: 0, z: 0, visibility: 0.99 };

    world[15] = { x: 0.4, y: 0, z: 0, visibility: 0.99 };

    d.update(p, 2634, atAngle(70));

    assert.equal(d.update(p, 2700, world).action, "jab");

    d.update(p, 2733);

    const raised = raisedUltimate();

    raised[13].visibility = 0.99;

    assert.equal(d.update(raised, 2833).action, "ultimate");

    assert.equal(d.update(raised, 2900).action, null);
});

const hookPose = (x = 0.3) => {
    const p = pose();

    p[14] = { x: 0.3, y: 0.4, z: 0, visibility: 0.99 };

    p[16] = { x, y: 0.24, z: 0, visibility: 0.99 };

    return p;
};
test("right horizontal sweep triggers once across frame rates and camera scales", () => {
    for (const fps of [15, 30, 60])
        for (const scale of [0.7, 1, 1.3]) {
            const d = new RightHookDetector();

            let count = 0;

            const transform = (p) =>
                p.map((q) => ({
                    ...q,
                    x: 0.5 + (q.x - 0.5) * scale,
                    y: 0.5 + (q.y - 0.5) * scale,
                    z: q.z * scale
                }));

            for (let frame = 0; frame <= fps; frame++)
                if (
                    d.update(
                        transform(hookPose(0.3 + Math.min(0.1, frame / fps))),
                        (frame * 1000) / fps
                    )
                )
                    count++;

            assert.equal(count, 1);

            assert.equal(d.update(transform(hookPose()), 1100), false);

            assert.equal(d.update(transform(hookPose(0.4)), 1200), true);
        }
});
test("right hook rejects slow sweeps, jitter, vertical movement, forward punches and body translation", () => {
    for (const kind of ["slow", "jitter", "vertical", "depth", "body", "outward"]) {
        const d = new RightHookDetector();

        for (let i = 0; i < 20; i++) {
            const p = hookPose();

            if (kind === "slow") p[16].x += i * 0.002;

            if (kind === "jitter") p[16].x += (i % 2) * 0.002;

            if (kind === "vertical") p[16].y -= i * 0.005;

            if (kind === "depth") p[16].z -= i * 0.01;

            if (kind === "body") p.forEach((q) => (q.x += i * 0.01));

            if (kind === "outward") p[16].x -= i * 0.005;

            assert.equal(d.update(p, i * 50), false, kind);
        }
    }
});
test("hook tracking loss, invisible wrist and coordinate source switches cannot trigger a stale hook", () => {
    const d = new RightHookDetector();

    d.update(hookPose(), 0);

    d.update([], 50);

    assert.equal(d.update(hookPose(0.4), 100), false);

    d.reset();

    d.update(hookPose(), 0);

    const hidden = hookPose(0.4);

    hidden[16].visibility = 0.1;

    assert.equal(d.update(hidden, 100), false);

    d.reset();

    d.update(hookPose(), 0);

    assert.equal(d.update(hookPose(0.4), 100, atAngle(90, 1)), false);
});
test("integrated camera hook releases guard and takes priority over slight simultaneous arm extension", () => {
    const d = calibrated();

    for (let i = 0; i < 3; i++) d.update(hookPose(), 2700 + i * 33, atAngle(90, 1));

    const r = d.update(hookPose(0.4), 2833, atAngle(110, 1));

    assert.equal(r.action, "hook");

    assert.equal(r.block, false);

    for (let i = 0; i < 10; i++)
        assert.equal(d.update(hookPose(0.4), 2866 + i * 33, atAngle(110, 1)).action, null);
});

test("uppercut recognizes single-hand raises at 15/30/60 fps with the other hand guarding near the face", () => {
    for (const fps of [15, 30, 60])
        for (const side of [0, 1]) {
            const d = new UltimateGestureDetector();

            let fired = 0;

            for (let frame = 0; frame <= fps; frame++) {
                const p = pose();

                p[15 + side].y = 0.3 - Math.min(0.2, (frame / fps) * 1.5);

                p[16 - side].y = 0.19;

                if (d.update(p, (frame * 1000) / fps)) fired++;
            }

            assert.equal(fired, 1);
        }
});
test("a fast raise spanning one 30 fps frame works, while head-only motion cannot fake an uppercut", () => {
    const d = new UltimateGestureDetector();

    d.update(pose(), 0);

    assert.equal(d.update(raisedUltimate(), 33), true);

    d.reset();

    const p = pose();

    p[15].y = 0.16;

    d.update(p, 0);

    p[0].y = 0.25;

    assert.equal(d.update(p, 50), false);
});
test("hook is not swallowed by the preceding jab detection cooldown", () => {
    const d = calibrated();

    let world = atAngle(70, 0);

    Object.assign(world[14], { x: 0.3, y: 0.4, z: 0 });

    Object.assign(world[16], { x: 0.3, y: 0.24, z: 0 });

    d.update(hookPose(), 2634, world);

    const extended = atAngle(110, 0);

    extended[14] = world[14];

    extended[16] = world[16];

    assert.equal(d.update(hookPose(), 2700, extended).action, "jab");

    extended[16] = { x: 0.4, y: 0.24, z: 0, visibility: 0.99 };

    assert.equal(d.update(hookPose(0.4), 2800, extended).action, "hook");
});

test("recognized hook and uppercut gestures start their actual combat actions in motion mode", () => {
    for (const action of ["hook", "ultimate"]) {
        const d = calibrated(),
            m = createMatch();

        m.phase = "fight";

        setInputMode(m, 0, "motion");

        m.fighters[0].stamina = 0;

        m.fighters[0].charge = 100;

        let result;

        if (action === "hook") {
            d.update(hookPose(), 2700);

            result = d.update(hookPose(0.4), 2800);
        } else {
            d.update(pose(), 2700);

            result = d.update(raisedUltimate(1), 2800);
        }

        assert.equal(result.action, action);

        act(m, 0, "block", false);

        assert.ok(act(m, 0, result.action));

        assert.equal(m.fighters[0].action, action);
    }
});
