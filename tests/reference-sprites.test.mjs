// ============================================================
// REFERENCE SPRITES REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";

test("reference artwork loads asynchronously and both mirrored arm rigs render finite transforms", async () => {
    const images = [];

    globalThis.Image = class {
        naturalWidth = 1024;
        naturalHeight = 1536;
        constructor () {
            images.push(this);
        }
    };

    const {
        drawReferenceBlock,
        referenceBlockReady,
        drawReferenceKnockdown,
        drawReferenceBody,
        drawReferenceArm,
        drawReferenceGlove,
        drawOpponentArm
    } = await import("../.test-build/src/game/reference-sprites.js");

    let depth = 0,
        draws = 0;

    const scales = [];

    const legTransforms = [];

    const painted = [];

    const c = new Proxy(
        { globalAlpha: 1, canvas: { width: 1000 } },
        {
            get: (target, key) =>
                key in target
                    ? target[key]
                    : (...args) => {
                          if (key === "save") depth++;

                          if (key === "restore") {
                              depth--;

                              assert.ok(depth >= 0);
                          }

                          if (key === "drawImage") {
                              draws++;

                              painted.push(args[0]);
                          }

                          if (key === "scale") scales.push(args);

                          if (key === "transform") legTransforms.push(args);

                          for (const a of args)
                              if (typeof a === "number") assert.ok(Number.isFinite(a));
                      }
        }
    );

    assert.equal(drawReferenceBody(c, 0), false);

    assert.equal(drawReferenceArm(c, [395, 407], [245, 650], false), false);

    assert.equal(drawReferenceGlove(c, 0, 0, 60, false), false);

    assert.equal(drawReferenceKnockdown(c, 1), false);

    assert.equal(referenceBlockReady(), false);

    assert.equal(drawReferenceBlock(c, 1), false);

    assert.equal(draws, 0);

    images.forEach((image) => image.onload());

    for (const duck of [0, 21, 42]) assert.equal(drawReferenceBody(c, duck), true);

    assert.equal(legTransforms.length, 6);

    for (const [a, b, , , x, y] of legTransforms) {
        assert.equal(a, 1);

        assert.equal(b, 0);

        assert.equal(x, 0);

        assert.equal(y, 0);
    }

    for (const flip of [false, true])
        for (const hand of [
            [395, 407],
            [500, 280],
            [500, 150]
        ]) {
            assert.equal(drawReferenceArm(c, hand, [flip ? 755 : 245, 650], flip), true);

            assert.equal(drawReferenceGlove(c, hand[0], hand[1], 60, flip), true);
        }

    // Reach and handedness must not inflate the first-person sprite.
    const armScales = scales.filter(([x, y]) => Math.abs(x) < 1 && y < 1);

    assert.equal(armScales.length, 6);

    assert.ok(armScales.every(([x, y]) => Math.abs(x) === 196 / 1536 && y === 196 / 1536));

    assert.equal(depth, 0);

    assert.equal(draws, 21);

    for (const side of [-1, 1])
        for (const returning of [false, true])
            for (const reach of [0, 0.25, 0.5, 0.75, 1]) {
                assert.equal(drawOpponentArm(c, side, [side * 40, -185], reach, returning), true);

                assert.equal(depth, 0);
            }

    const beforeKnockdown = draws;

    for (const amount of [0, 0.01, 0.5, 1])
        for (const effort of [0, 0.5, 1]) {
            assert.equal(drawReferenceKnockdown(c, amount, effort, 2), true);

            assert.equal(depth, 0);
        }

    assert.equal(draws - beforeKnockdown, 12, "one complete sprite per knockdown frame");

    assert.equal(referenceBlockReady(), true);

    for (const guard of [0, 0.25, 0.5, 1])
        for (const impact of [0, 1]) {
            assert.equal(drawReferenceBlock(c, guard, impact), true);

            assert.equal(depth, 0);
        }

    const { renderArena } = await import("../.test-build/src/game/renderer.js");

    const { createMatch } = await import("../.test-build/shared/combat.js");

    const match = createMatch();

    match.phase = "knockdown";

    match.down = 0;

    match.fighters[0].hp = 0;

    match.recoveryTicks = 500;

    const knockedImage = images.find((image) => image.src === "/art/boxer-knocked.png");

    for (const view of [0, 1]) {
        painted.length = 0;

        const snapshot = JSON.stringify(match);

        renderArena(c, match, 3, false, view);

        assert.ok(
            painted.includes(knockedImage),
            "both viewpoints use the supplied knockdown sprite"
        );

        assert.equal(depth, 0);

        assert.equal(JSON.stringify(match), snapshot);
    }

    match.phase = "fight";

    match.fighters[0].hp = 135;

    const blockImage = images.find((image) => image.src === "/art/first-person-block.png");

    for (const view of [0, 1]) {
        match.fighters[view].action = "block";

        match.fighters[view].age = 8;

        painted.length = 0;

        const snapshot = JSON.stringify(match);

        renderArena(c, match, 3, false, view);

        assert.ok(painted.includes(blockImage), "first-person blocking uses the supplied artwork");

        assert.equal(depth, 0);

        assert.equal(JSON.stringify(match), snapshot);

        match.fighters[view].action = "idle";
    }

    delete globalThis.Image;
});
