import { test } from "node:test";
import assert from "node:assert/strict";
import { placeActionGhost } from "../src/game/ghost-placement";

test("random ghosts leave room for cameras, HUD, telemetry and their fading trails", () => {
    for (const compact of [false, true]) {
        const width = compact ? 390 : 1440;
        const height = compact ? 844 : 900;
        const obstacles = [
            { left: 0, top: 0, right: width, bottom: 210 },
            { left: 12, top: 230, right: compact ? 189 : 356, bottom: 450 },
            { left: compact ? 201 : 1084, top: 230, right: width - 12, bottom: 450 },
            { left: 12, top: compact ? 740 : 650, right: 292, bottom: height - 16 }
        ];
        const positions = new Set<string>();
        for (let seed = 0; seed < 100; seed++) {
            const point = placeActionGhost(width, height, compact, obstacles, () => seed / 100);
            assert.ok(point);
            positions.add(JSON.stringify(point));
            const right = point.x + (compact ? 110 : 150) + 36;
            const bottom = point.y + (compact ? 180 : 220) + 36;
            assert.ok(point.x >= 36 && point.y >= 36 && right <= width && bottom <= height);
            for (const box of obstacles) {
                assert.ok(
                    right <= box.left ||
                        point.x - 36 >= box.right ||
                        bottom <= box.top ||
                        point.y - 36 >= box.bottom
                );
            }
        }
        assert.ok(positions.size > 1, "echo locations remain varied");
    }
});

test("a crowded or very short viewport skips the decorative ghost", () => {
    assert.equal(placeActionGhost(320, 200, true, []), null);
    assert.equal(
        placeActionGhost(800, 600, false, [{ left: 0, top: 0, right: 800, bottom: 600 }]),
        null
    );
});
