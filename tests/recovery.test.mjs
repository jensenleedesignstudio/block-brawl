// ============================================================
// RECOVERY REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, knockdown, act, step } from "../.test-build/shared/combat.js";
import { RecoveryGestureDetector, recoveryHands } from "../.test-build/src/motion/recovery.js";

// ------------------------------------------------------------
// HAND
// ------------------------------------------------------------

function hand (side = "Right", y = 0.5, x = 0.5) {
    return {
        worldLandmarks: [],
        landmarks: Array.from({ length: 21 }, () => ({ x, y, z: 0 })),
        handedness: side,
        score: 0.2
    };
}
test("either hand can repeatedly count up/down strokes without palm or handedness confidence gates", () => {
    for (const side of ["Left", "Right"]) {
        const d = new RecoveryGestureDetector();

        d.update([hand(side)], 0, 0.2);

        for (let i = 0; i < 8; i++)
            assert.notEqual(
                d.update([hand(side, i % 2 ? 0.5 : 0.4)], 100 + i * 100, 0.2).side,
                null
            );
    }
});
test("one dramatic stroke and subsequent top hold count only once; horizontal movement and jitter do not count", () => {
    const d = new RecoveryGestureDetector();

    d.update([hand()], 0, 0.2);

    assert.notEqual(d.update([hand("Right", 0.4)], 100, 0.2).side, null);

    for (let t = 200; t <= 1200; t += 100)
        assert.equal(
            d.update([hand("Right", 0.4 + (t % 300 === 0 ? 0.002 : 0), t / 1500)], t, 0.2).side,
            null
        );

    assert.equal(d.update([hand("Right", 0.35)], 1300, 0.2).side, null);
});
test("a slower lift counts at a brief top pause, never on every held frame", () => {
    const d = new RecoveryGestureDetector();

    d.update([hand()], 0, 0.2);

    for (let t = 100; t <= 600; t += 100)
        assert.equal(d.update([hand("Right", 0.5 - t * 0.00005)], t, 0.2).side, null);

    let count = 0;

    for (let t = 700; t <= 1600; t += 100)
        if (d.update([hand("Right", 0.47)], t, 0.2).side !== null) count++;

    assert.equal(count, 1);
});
test("tracking loss, duplicate timestamps, invalid coordinates, and reappearance cannot fabricate strokes", () => {
    const d = new RecoveryGestureDetector();

    d.update([hand()], 0, 0.2);

    assert.equal(d.update([hand("Right", 0.3)], 0, 0.2).side, null);

    d.update([], 300, 0.2);

    assert.equal(d.update([hand("Right", 0.3)], 400, 0.2).side, null);

    assert.equal(d.update([hand("Right", NaN)], 500, 0.2).side, null);

    assert.equal(d.update([hand("Right", 0.3)], 600, 0.2).side, null);
});
test("brief detection gap preserves a real stroke", () => {
    const d = new RecoveryGestureDetector();

    d.update([hand()], 0, 0.2);

    d.update([], 50, 0.2);

    assert.notEqual(d.update([hand("Right", 0.4)], 100, 0.2).side, null);
});
test("both hands in one frame queue two independent movements", () => {
    const d = new RecoveryGestureDetector();

    d.update([hand("Left"), hand("Right")], 0, 0.2);

    assert.equal(d.update([hand("Left", 0.4), hand("Right", 0.4)], 100, 0.2).side, 0);

    assert.equal(d.update([hand("Left", 0.4), hand("Right", 0.4)], 200, 0.2).side, 1);

    assert.equal(d.update([hand("Left", 0.4), hand("Right", 0.4)], 300, 0.2).side, null);
});
test("one hand can complete actual revives at 20, 60, and 100 movements", () => {
    const d = new RecoveryGestureDetector(),
        m = createMatch();

    for (const goal of [20, 60, 100]) {
        m.phase = "fight";

        m.fighters[0].hp = 0;

        knockdown(m, 0);

        d.reset();

        assert.equal(m.recoveryGoal, goal);

        d.update([hand()], 0, 0.2);

        for (let i = 0; i < goal; i++) {
            // 80 ms per stroke fits the 100-input goal within ten seconds.
            for (let t = 0; t < 5; t++) step(m);

            assert.notEqual(
                d.update([hand("Right", i % 2 ? 0.5 : 0.4)], (i + 1) * 80, 0.2).side,
                null
            );

            assert.ok(act(m, 0, "recover"));
        }

        assert.equal(m.fighters[0].hp, 60);

        assert.equal(m.phase, "countdown");
    }
});
test("camera recovery respects phase, downed player and rate limits; keyboard still alternates", () => {
    const m = createMatch();

    m.phase = "fight";

    assert.equal(act(m, 0, "recover"), false);

    knockdown(m, 0);

    assert.equal(act(m, 1, "recover"), false);

    assert.ok(act(m, 0, "jab"));

    for (let i = 0; i < 5; i++) step(m);

    assert.equal(act(m, 0, "jab"), false);

    assert.ok(act(m, 0, "recover"));

    assert.equal(act(m, 0, "recover"), false);

    for (let i = 0; i < 5; i++) step(m);

    assert.equal(act(m, 0, "jab"), false);

    assert.ok(act(m, 0, "cross"));

    const d = new RecoveryGestureDetector();

    d.update([hand()], 0, 0.2);

    d.reset();

    assert.equal(d.update([hand("Right", 0.2)], 100, 0.2).side, null);
});

test("slow continuous raises and lowers count without requiring a fast stroke", () => {
    const d = new RecoveryGestureDetector();

    let count = 0;

    d.update([hand()], 0, 0.2);

    for (let i = 1; i <= 12; i++)
        if (d.update([hand("Right", 0.5 - i * 0.005)], i * 100, 0.2).side !== null) count++;

    for (let i = 1; i <= 12; i++)
        if (d.update([hand("Right", 0.44 + i * 0.005)], 1200 + i * 100, 0.2).side !== null) count++;

    assert.equal(count, 2);
});
test("pose wrists revive without a hand model, and tracker switches cannot create a stroke", () => {
    const d = new RecoveryGestureDetector(),
        m = createMatch();

    m.phase = "fight";

    knockdown(m, 0);

    const pose = (y) => {
        const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));

        p[15] = { x: 0.5, y, z: 0, visibility: 0.9 };

        return p;
    };

    d.update(recoveryHands([], pose(0.5)), 0, 0.2);

    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 6; j++) step(m);

        const result = d.update(recoveryHands([], pose(i % 2 ? 0.5 : 0.4)), 100 + i * 100, 0.2);

        assert.equal(result.side, 0);

        assert.ok(act(m, 0, "recover"));
    }

    assert.equal(m.fighters[0].hp, 60);

    d.reset();

    d.update(recoveryHands([], pose(0.5)), 0, 0.2);

    assert.equal(d.update(recoveryHands([hand("Left", 0.3)], []), 100, 0.2).side, null);

    assert.equal(
        recoveryHands(
            [],
            pose(0.5).map((p) => ({ ...p, visibility: 0.1 }))
        ).length,
        0
    );
});
