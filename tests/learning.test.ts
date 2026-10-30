// ============================================================
// LEARNING REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch, act, step } from "../shared/combat.js";
import {
    POLICY_ACTIONS,
    policyMask,
    policyObservation,
    applyPolicyAction
} from "../shared/learning.js";
import { LearnedBot } from "../shared/learned-ai.js";

test("policy features and masks are finite, viewpoint-relative and non-mutating", () => {
    const m = createMatch();

    m.phase = "fight";

    const before = JSON.stringify(m);

    assert.deepEqual(policyObservation(m, 0), policyObservation(m, 1));

    assert.ok(policyObservation(m, 0).every((n) => Number.isFinite(n) && n >= 0 && n <= 1));

    assert.equal(policyMask(m, 0).length, POLICY_ACTIONS.length);

    assert.equal(JSON.stringify(m), before);
});
test("policy masks respect stamina, charge and active actions", () => {
    const m = createMatch();

    m.phase = "fight";

    m.fighters[0].stamina = 0;

    let mask = policyMask(m, 0);

    for (const id of [1, 2, 3, 11]) assert.equal(mask[id], false);

    const before = JSON.stringify(m);

    assert.equal(applyPolicyAction(m, 0, 1), false);

    assert.equal(JSON.stringify(m), before);

    m.fighters[0].stamina = 250;

    assert.equal(applyPolicyAction(m, 0, 1), true);

    assert.equal(m.fighters[0].action, "jab");

    mask = policyMask(m, 0);

    assert.equal(mask[0], true);

    assert.equal(mask[2], false);

    assert.equal(applyPolicyAction(m, 0, 999), false);
});
test("learned bot queues replies until an update and ignores stale decisions", async () => {
    const original = globalThis.fetch;

    try {
        globalThis.fetch = async () =>
            new Response(JSON.stringify({ version: 1, action: 1 }), { status: 200 });

        const m = createMatch();

        m.phase = "fight";

        m.fighters[1].x = 435;

        const bot = new LearnedBot("hard", 1);

        bot.status = "ready";

        bot.update(m, 0);

        assert.equal(m.fighters[0].action, "idle");

        await new Promise((resolve) => setTimeout(resolve, 10));

        assert.equal(m.fighters[0].action, "idle");

        m.tick = 1;

        bot.update(m, 0);

        assert.equal(m.fighters[0].action, "jab");

        await new Promise((resolve) => setTimeout(resolve, 10));

        const stale = createMatch();

        stale.phase = "fight";

        const slow = new LearnedBot("hard", 1);

        slow.status = "ready";

        slow.update(stale, 0);

        await new Promise((resolve) => setTimeout(resolve, 10));

        stale.tick = 20;

        slow.update(stale, 0);

        assert.equal(stale.fighters[0].action, "idle");

        await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
        globalThis.fetch = original;
    }
});
test("all live difficulties keep a passive model reply without scripted tactical overrides", async () => {
    const original = globalThis.fetch;

    try {
        globalThis.fetch = async () =>
            new Response(JSON.stringify({ version: 1, action: 0 }), { status: 200 });

        for (const difficulty of ["easy", "medium", "hard"] as const) {
            const m = createMatch();

            m.phase = "fight";

            m.fighters[1].x = 435;

            act(m, 1, "cross");

            for (let i = 0; i < 7; i++) step(m);

            const bot = new LearnedBot(difficulty, 1);

            bot.status = "ready";

            bot.update(m, 0);

            await new Promise((resolve) => setTimeout(resolve, 10));

            m.tick++;

            bot.update(m, 0);

            assert.equal(
                m.fighters[0].action,
                "idle",
                "only the model may choose a defensive action"
            );

            if (difficulty === "medium") {
                m.tick = 13;

                bot.update(m, 0);

                assert.equal(
                    m.fighters[0].action,
                    "idle",
                    "medium keeps the trained decision without hard tactics"
                );
            }
        }
    } finally {
        globalThis.fetch = original;
    }
});
test("easy learned opponent waits to react and spaces attacks without ultimates", async () => {
    const original = globalThis.fetch;

    const masks: boolean[][] = [];

    try {
        globalThis.fetch = async (_url, options) => {
            masks.push(JSON.parse(String(options?.body)).action_mask);

            return new Response(JSON.stringify({ version: 1, action: 1 }), { status: 200 });
        };

        const m = createMatch();

        m.phase = "fight";

        const bot = new LearnedBot("easy", 7);

        bot.status = "ready";

        bot.update(m, 0);

        await new Promise((resolve) => setTimeout(resolve, 10));

        m.tick = 1;

        bot.update(m, 0);

        assert.equal(m.fighters[0].action, "idle");

        m.tick = 12;

        bot.update(m, 0);

        assert.equal(m.fighters[0].action, "jab");

        m.fighters[0].action = "idle";

        m.tick = 30;

        bot.update(m, 0);

        await new Promise((resolve) => setTimeout(resolve, 10));

        m.tick = 42;

        bot.update(m, 0);

        assert.equal(m.fighters[0].action, "idle");

        assert.equal(masks[0][11], false, "easy never requests an ultimate");

        assert.equal(masks[1][1], false, "easy cannot immediately repeat a punch");
    } finally {
        globalThis.fetch = original;
    }
});

test("unavailable trained models never fall back to scripted combat", async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => {
            throw new Error("service offline");
        };
        for (const difficulty of ["easy", "medium", "hard"] as const) {
            const match = createMatch();
            match.phase = "fight";
            const bot = new LearnedBot(difficulty, 1);
            const x = match.fighters[1].x;
            bot.update(match);
            await new Promise((resolve) => setTimeout(resolve, 5));
            assert.equal(bot.status, "unavailable");
            match.tick = 300;
            bot.update(match);
            assert.equal(match.fighters[1].action, "idle");
            assert.equal(match.fighters[1].x, x);
            assert.equal(match.fighters[1].hits, 0);
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
    } finally {
        globalThis.fetch = original;
    }
});
