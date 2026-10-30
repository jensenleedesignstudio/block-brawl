// ============================================================
// PUNCH MOTION REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { punchExtension, ultimateHands } from "../.test-build/src/game/punch-motion.js";
import { ATTACKS, ULTIMATE_STRIKES } from "../.test-build/shared/combat.js";
test("normal punches ease through fractional frames and settle before recovery ends", () => {
    for (const attack of ["jab", "cross", "hook"]) {
        const contact = ATTACKS[attack].startup;

        assert.equal(punchExtension(attack, 0), 0);

        assert.equal(punchExtension(attack, contact), 1);

        const end = contact + ATTACKS[attack].active + ATTACKS[attack].recovery;

        assert.equal(punchExtension(attack, end - 1), 0);

        for (let age = 0; age < end; age += 0.125) {
            const a = punchExtension(attack, age),
                b = punchExtension(attack, age + 0.125);

            assert.ok(a >= 0 && a <= 1);

            assert.ok(Math.abs(b - a) < 0.04, "no discontinuous jump between render frames");

            if (age < contact) assert.ok(b >= a);
            else assert.ok(b <= a);
        }
    }
});
test("uppercut holds the other fist still and moves one fist vertically in both views", () => {
    for (const firstPerson of [true, false]) {
        const start = ultimateHands(0, firstPerson),
            loaded = ultimateHands(22, firstPerson),
            impact = ultimateHands(28, firstPerson);

        for (let age = 0; age <= 36; age++) {
            const hands = ultimateHands(age, firstPerson);

            assert.deepEqual(hands.left, start.left);

            assert.equal(hands.right[0], start.right[0]);
        }

        assert.ok(loaded.right[1] > start.right[1]);

        assert.ok(impact.right[1] < start.right[1] - 100);
    }
});
test("three smaller followup punches remain distinct after the uppercut", () => {
    const [a, b, c] = ULTIMATE_STRIKES.slice(1).map((s) => ultimateHands(s.frame, true));

    assert.ok(a.left[1] < 407);

    assert.equal(a.right[1], 407);

    assert.equal(b.left[1], 407);

    assert.ok(b.right[1] < 407);

    assert.ok(c.left[1] < 407);
});
