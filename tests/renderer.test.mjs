// ============================================================
// RENDERER REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderArena } from "../.test-build/src/game/renderer.js";
import { createMatch, ACTIONS } from "../.test-build/shared/combat.js";
test("every animated pose renders finite geometry, balances canvas state, and leaves combat untouched", () => {
    let depth = 0,
        draws = 0;

    const c = new Proxy(
        { canvas: { width: 1000 } },
        {
            get (target, key) {
                if (key in target) return target[key];

                return (...args) => {
                    if (key === "save") depth++;

                    if (key === "restore") {
                        depth--;

                        assert.ok(depth >= 0);
                    }

                    for (const value of args)
                        if (typeof value === "number")
                            assert.ok(Number.isFinite(value), `${key}: nonfinite coordinate`);

                    if (key === "ellipse") {
                        assert.ok(args[2] >= 0 && args[3] >= 0);

                        draws++;
                    }
                };
            }
        }
    );

    const m = createMatch();

    m.fighters[0].x = 430;

    m.fighters[1].x = 570;

    for (const action of [...ACTIONS, "hurt", "dazed", "idle"])
        for (const age of [0, 3, 7, 13, 22, 28, 36, 42, 50, 58, 83])
            for (const view of [0, 1]) {
                m.phase = "fight";

                for (const f of m.fighters) {
                    f.action = action;

                    f.age = age;
                }

                m.tick = age;

                m.events = [
                    { id: 1, x: 500, target: 1 - view, kind: "hit", damage: 6, tick: age - 3 }
                ];

                const before = JSON.stringify(m);

                renderArena(c, m, age / 60, false, view, 0.5);

                assert.equal(JSON.stringify(m), before);

                assert.equal(depth, 0);
            }

    for (const phase of ["knockdown", "countdown", "finished"])
        for (const ticks of [600, 590, 560, 1])
            for (const view of [0, 1]) {
                m.phase = phase;

                m.down = 0;

                m.recoveryTicks = ticks;

                m.countdown = 30;

                m.recovery = 10;

                m.fighters[0].hp = phase === "countdown" ? 60 : 0;

                m.fighters[0].knockdowns = 1;

                const before = JSON.stringify(m);

                renderArena(c, m, 10, false, view);

                renderArena(c, m, 10, false, view, 0, true);

                assert.equal(depth, 0);

                assert.equal(JSON.stringify(m), before);
            }

    assert.ok(draws > 0);
});
