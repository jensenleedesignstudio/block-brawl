import { test } from "node:test";
import assert from "node:assert/strict";
import { shadeLeather } from "../src/game/sprite-material.js";

test("leather finishes preserve alpha, skin, cloth, wraps and transparent padding for both corners", () => {
    const source = new Uint8ClampedArray([
        30,
        100,
        220,
        255,
        70,
        170,
        250,
        128, // blue leather, including an antialiased edge
        190,
        120,
        80,
        255,
        60,
        110,
        80,
        255, // skin, green cloth
        170,
        220,
        230,
        255,
        10,
        90,
        210,
        0,
        60,
        40,
        110,
        255 // purple hair is not blue leather // pale wrap, transparent padding
    ]);
    for (const red of [true, false]) {
        const pixels = source.slice();
        shadeLeather(pixels, 3, red);
        for (let i = 3; i < pixels.length; i += 4) assert.equal(pixels[i], source[i]);
        assert.deepEqual(pixels.slice(8), source.slice(8));
        assert.ok(pixels[4] > pixels[0], "source highlight remains brighter than shadow");
        assert.ok(red ? pixels[0] > pixels[2] : pixels[2] > pixels[0]);
        const repeat = source.slice();
        shadeLeather(repeat, 3, red);
        assert.deepEqual(repeat, pixels, "material processing is deterministic");
    }
});
