import { test } from "node:test";
import assert from "node:assert/strict";
import { RenderBudget } from "../src/game/render-budget";

test("high-refresh displays do not multiply scenery work", () => {
    for (const refresh of [30, 60, 120, 144, 165, 240]) {
        const budget = new RenderBudget();
        let paints = 0;
        for (let frame = 0; frame < refresh; frame++) {
            if (budget.shouldPaint((frame * 1000) / refresh)) paints++;
        }
        assert.equal(paints, Math.min(refresh, 60));
    }
});

test("slow painting reduces pixel work with hysteresis and recovers gradually", () => {
    const budget = new RenderBudget();
    for (let now = 0; now <= 4500; now += 100) budget.record(20, now);
    assert.equal(budget.scale, 0.5);
    assert.equal(budget.scale ** 2, 0.25, "minimum quality paints a quarter of the pixels");
    for (let now = 4600; now <= 6000; now += 100) budget.record(2, now);
    assert.equal(budget.scale, 0.5, "brief recoveries do not flicker between resolutions");
    for (let now = 6100; now <= 15000; now += 100) budget.record(2, now);
    assert.equal(budget.scale, 1);
});

test("GPU-delayed frames lower resolution even when canvas submission is fast", () => {
    const budget = new RenderBudget();
    for (let now = 0; now <= 4500; now += 100) budget.record(2, now, 34);
    assert.equal(budget.scale, 0.5);
});
