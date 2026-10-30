// ============================================================
// ARENA WORLD REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, ringPositions } from "../.test-build/shared/combat.js";
import { arenaCamera, projectPoint, drawWorld } from "../.test-build/src/game/arena-world.js";
import { drawGymPhotograph } from "../.test-build/src/game/gym-photography.js";

test("gym scenery stays finite and preserves combat state around both fighters", () => {
    const m = createMatch();
    m.fighters[0].x = 432.5;
    m.fighters[1].x = 567.5;
    let depth = 0,
        polygons = 0;
    const context = new Proxy(
        {},
        {
            get:
                (_target, key) =>
                (...args) => {
                    if (key === "save") depth++;
                    if (key === "restore") depth--;
                    if (key === "fill") polygons++;
                    assert.ok(depth >= 0);
                    for (const value of args)
                        if (typeof value === "number")
                            assert.ok(
                                Number.isFinite(value),
                                `${String(key)} has invalid geometry`
                            );
                }
        }
    );
    for (const view of [0, 1])
        for (let turn = 0; turn < 16; turn++) {
            m.orbit = (turn * Math.PI) / 8;
            const before = JSON.stringify(m);
            drawWorld(context, arenaCamera(m, view));
            assert.equal(JSON.stringify(m), before);
            assert.equal(depth, 0);
        }
    assert.ok(polygons > 1000);
});

test("orbit camera keeps the opponent centered through a complete lap from either side", () => {
    const m = createMatch();

    m.fighters[0].x = 432.5;

    m.fighters[1].x = 567.5;

    for (const view of [0, 1])
        for (let turn = 0; turn <= 32; turn++) {
            m.orbit = (turn * Math.PI) / 16;

            const camera = arenaCamera(m, view),
                target = ringPositions(m)[1 - view];

            const projected = projectPoint(camera, { ...target, z: 0 });

            assert.ok(Math.abs(projected.x - 500) < 1e-8);

            assert.ok(Math.abs(projected.depth - 315) < 1e-8);
        }
});
test("fixed scenery passes from front to behind and returns after a full circle", () => {
    const m = createMatch(),
        landmark = { x: -560, y: 0, z: 100 };

    const initial = projectPoint(arenaCamera(m, 0), landmark);

    m.orbit = Math.PI / 2;

    const quarter = projectPoint(arenaCamera(m, 0), landmark);

    m.orbit = Math.PI;

    const opposite = projectPoint(arenaCamera(m, 0), landmark);

    m.orbit = Math.PI * 2;

    const full = projectPoint(arenaCamera(m, 0), landmark);

    assert.ok(initial.depth > 0);

    assert.ok(Math.abs(quarter.x - 500) > 100);

    assert.ok(opposite.depth < 0);

    assert.ok(Math.abs(initial.x - full.x) < 1e-8);

    assert.ok(Math.abs(initial.y - full.y) < 1e-8);
});

test("photographic room reveals different walls through a full orbit and restores sprite sampling", () => {
    const original = globalThis.Image;
    const images = [];
    globalThis.Image = class {
        naturalWidth = 2172;
        naturalHeight = 724;
        onload = null;
        src = "";
        constructor () {
            images.push(this);
        }
    };
    const draws = [],
        stack = [];
    const finite = (...args) => {
        for (const n of args) if (typeof n === "number") assert.ok(Number.isFinite(n));
    };
    const context = {
        imageSmoothingEnabled: false,
        save () {
            stack.push(this.imageSmoothingEnabled);
        },
        restore () {
            this.imageSmoothingEnabled = stack.pop();
        },
        drawImage (...args) {
            draws.push(args);
            finite(...args);
        },
        transform: finite,
        moveTo: finite,
        lineTo: finite
    };
    const c = new Proxy(context, {
        get: (target, key) => (key in target ? target[key] : () => {})
    });
    try {
        const m = createMatch();
        assert.equal(drawGymPhotograph(c, arenaCamera(m, 0)), false);
        const image = images[0];
        assert.equal(image.src, "/art/gym/field-house-panorama.png");
        image.onload();
        assert.equal(
            drawGymPhotograph(c, arenaCamera(m, 0)),
            false,
            "wait for both room materials"
        );
        const timber = images[1];
        assert.equal(timber.src, "/art/gym/oak-floor-texture.png");
        timber.onload();
        const wallViews = [];
        for (let turn = 0; turn <= 32; turn++) {
            m.orbit = (turn * Math.PI) / 16;
            const before = JSON.stringify(m);
            draws.length = 0;
            assert.equal(drawGymPhotograph(c, arenaCamera(m, 0)), true);
            assert.equal(c.imageSmoothingEnabled, false, "textures cannot blur sprite rendering");
            assert.equal(stack.length, 0);
            assert.equal(JSON.stringify(m), before);
            const walls = draws.filter((args) => args[0] === image);
            assert.ok(walls.length > 0, "room walls cover each camera bearing");
            wallViews.push(
                walls.reduce((sum, args) => sum + args[1] + args[3] / 2, 0) / walls.length
            );
        }
        assert.ok(
            new Set(wallViews.map((n) => Math.round(n / 100))).size >= 4,
            "camera sees different fixed wall textures, not a reversing flat image"
        );
        assert.ok(
            Math.abs(wallViews[0] - wallViews.at(-1)) < 1e-8,
            "a full orbit returns to the same wall"
        );
        m.ringX = 140;
        m.ringY = -100;
        draws.length = 0;
        drawGymPhotograph(c, arenaCamera(m, 0));
        assert.ok(
            draws.some((args) => args[0] === timber),
            "world floor remains textured when fighters move away from center"
        );
    } finally {
        globalThis.Image = original;
    }
});
