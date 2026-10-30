// ============================================================
// PRESENTATION REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../.test-build/shared/combat.js";
import { ArenaPresentation, impactRecoil } from "../.test-build/src/game/presentation.js";
test("presentation eases position while actions, health and combat state stay authoritative", () => {
    const m = createMatch();

    m.phase = "fight";

    const p = new ArenaPresentation();

    p.frame(m, 16);

    m.fighters[0].x += 18;

    m.fighters[0].hp = 180;

    m.fighters[0].action = "jab";

    m.tick++;

    const before = JSON.stringify(m),
        frame = p.frame(m, 16);

    assert.ok(frame.fighters[0].x > 300 && frame.fighters[0].x < 318);

    assert.equal(frame.fighters[0].hp, 180);

    assert.equal(frame.fighters[0].action, "jab");

    assert.equal(JSON.stringify(m), before);

    assert.equal(p.frame(m, 0).fighters[0].x, frame.fighters[0].x);
});
test("smoothing is display-rate independent and resets across round transitions", () => {
    const positions = [];

    for (const fps of [30, 60, 120]) {
        const m = createMatch(),
            p = new ArenaPresentation();

        m.phase = "fight";

        p.frame(m, 0);

        m.fighters[0].x = 400;

        m.tick = 1;

        let frame;

        for (let i = 0; i < fps; i++) frame = p.frame(m, 1000 / fps);

        positions.push(frame.fighters[0].x);

        m.phase = "knockdown";

        m.fighters[0].x = 450;

        assert.equal(p.frame(m, 16).fighters[0].x, 450);

        const reset = createMatch();

        assert.equal(p.frame(reset, 16).fighters[0].x, 300);
    }

    assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-8);
});
test("impact recoil starts and ends at rest with bounded displacement", () => {
    assert.deepEqual(impactRecoil(-1), { x: 0, y: 0 });

    assert.deepEqual(impactRecoil(12), { x: 0, y: 0 });

    for (let age = 0; age < 12; age += 0.25) {
        const r = impactRecoil(age);

        assert.ok(Math.abs(r.x) <= 4 && Math.abs(r.y) <= 3);
    }
});
