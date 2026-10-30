// ============================================================
// COMBAT REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import {
    act,
    createMatch,
    move,
    step,
    setInputMode,
    ATTACKS,
    MAX_HP,
    ROUND_SECONDS,
    FPS,
    MAX_CHARGE,
    MAX_STAMINA,
    ringPositions,
    RECOVERY_GOAL,
    GETUP_HP,
    knockdown
} from "../.test-build/shared/combat.js";
import { Bot } from "../.test-build/shared/ai.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const advance = (m, n) => {
    for (let i = 0; i < n; i++) step(m);
};
const fight = () => {
    const m = createMatch();

    advance(m, 180);

    m.fighters[0].x = 430;

    m.fighters[1].x = 565;

    return m;
};
test("countdown gates actions then automatically closes distance", () => {
    const m = createMatch();

    assert.equal(act(m, 0, "jab"), false);

    advance(m, 180);

    assert.equal(m.phase, "fight");

    advance(m, 100);

    assert.ok(m.fighters[1].x - m.fighters[0].x <= 136);
});
test("camera movement retreats, advances, and stops at ring and opponent bounds", () => {
    const m = fight();

    const start = m.fighters[0].x;

    assert.ok(move(m, 0, -1));

    advance(m, 10);

    assert.ok(m.fighters[0].x < start);

    move(m, 0, 1);

    advance(m, 10);

    assert.ok(m.fighters[0].x >= start);

    advance(m, 200);

    assert.ok(m.fighters[0].x <= m.fighters[1].x - 80);

    move(m, 0, -1);

    advance(m, 300);

    assert.equal(m.fighters[0].x, 130);

    move(m, 0, 0);

    assert.equal(m.fighters[0].movement, 0);
});
test("player two movement uses their facing direction", () => {
    const m = fight();

    const start = m.fighters[1].x;

    move(m, 1, -1);

    advance(m, 5);

    assert.ok(m.fighters[1].x > start);

    move(m, 1, 1);

    advance(m, 5);

    assert.ok(m.fighters[1].x <= start);
});
test("attack startup, single hit and recovery prevent spam", () => {
    const m = fight();

    assert.ok(act(m, 0, "jab"));

    assert.equal(act(m, 0, "cross"), false);

    advance(m, 6);

    assert.equal(m.fighters[1].hp, MAX_HP);

    advance(m, 1);

    assert.equal(m.fighters[1].hp, MAX_HP - 6);

    advance(m, 25);

    assert.equal(m.fighters[1].hp, MAX_HP - 6);

    assert.ok(act(m, 0, "cross"));
});
test("attacks outside range miss", () => {
    const m = fight();

    m.fighters[1].x = 800;

    act(m, 0, "hook");

    advance(m, 25);

    assert.equal(m.fighters[1].hp, MAX_HP);

    assert.equal(m.events.at(-1).kind, "miss");
});
test("holding block reduces damage and releasing clears guard", () => {
    const m = fight();

    act(m, 1, "block");

    act(m, 0, "hook");

    advance(m, 24);

    assert.equal(m.fighters[1].hp, MAX_HP - 4);

    act(m, 1, "block", false);

    assert.equal(m.fighters[1].action, "idle");

    assert.equal(m.fighters[1].blockHeld, false);
});
test("guard meter drains, breaks, and recharges before blocking again", () => {
    const m = fight();

    assert.ok(act(m, 0, "block"));

    advance(m, 150);

    assert.equal(m.fighters[0].action, "idle");

    assert.equal(m.fighters[0].guardBroken, true);

    assert.equal(act(m, 0, "block"), false);

    advance(m, 100);

    assert.equal(m.fighters[0].guardBroken, false);

    assert.ok(act(m, 0, "block"));
});
test("a block timed just before impact negates damage and dazes the attacker", () => {
    const m = fight();

    act(m, 0, "cross");

    advance(m, 8);

    act(m, 1, "block");

    advance(m, 5);

    assert.equal(m.fighters[1].hp, MAX_HP);

    assert.equal(m.fighters[0].action, "dazed");

    assert.equal(m.events.at(-1).kind, "parry");

    assert.equal(act(m, 0, "jab"), false);
});
test("dodge avoids straights but hooks catch it", () => {
    for (const attack of ["jab", "cross", "hook"]) {
        const m = fight();

        act(m, 1, "dodgeLeft");

        act(m, 0, attack);

        advance(m, 22);

        assert.equal(m.fighters[1].hp, attack === "hook" ? MAX_HP - 16 : MAX_HP);
    }
});
test("duck avoids hooks and crosses but not jabs", () => {
    for (const attack of ["jab", "cross", "hook"]) {
        const m = fight();

        act(m, 1, "duck");

        act(m, 0, attack);

        advance(m, 22);

        assert.equal(m.fighters[1].hp, attack === "jab" ? MAX_HP - 6 : MAX_HP);
    }
});
test("defense has recovery and cannot be continuously retriggered", () => {
    const m = fight();

    act(m, 0, "dodgeRight");

    advance(m, 27);

    assert.equal(act(m, 0, "dodgeRight"), false);

    advance(m, 22);

    assert.equal(act(m, 0, "dodgeRight"), true);
});
test("zero health starts a ten-second count, then locks knockout if recovery fails", () => {
    const m = fight();

    m.fighters[1].hp = 5;

    act(m, 0, "cross");

    advance(m, 13);

    assert.equal(m.phase, "knockdown");

    assert.equal(m.down, 1);

    assert.equal(m.fighters[1].hp, 0);

    const remaining = m.remaining,
        orbit = m.orbit;

    advance(m, 599);

    assert.equal(m.phase, "knockdown");

    assert.equal(m.remaining, remaining);

    assert.equal(m.orbit, orbit);

    step(m);

    assert.equal(m.phase, "finished");

    assert.equal(m.winner, 0);

    assert.equal(act(m, 1, "jab"), false);

    const tick = m.tick;

    advance(m, 30);

    assert.equal(m.tick, tick);
});
test("alternating recovery works for either fighter and safely resumes at 60 HP", () => {
    for (const index of [0, 1]) {
        const m = fight();

        m.fighters[index].hp = 0;

        knockdown(m, index);

        assert.equal(act(m, 1 - index, "jab"), false);

        assert.equal(act(m, index, "ultimate"), false);

        for (let i = 0; i < RECOVERY_GOAL; i++) {
            assert.ok(act(m, index, i % 2 ? "cross" : "jab"));

            advance(m, 3);
        }

        assert.equal(m.phase, "countdown");

        assert.equal(m.fighters[index].hp, GETUP_HP);

        assert.equal(m.down, null);

        advance(m, 60);

        assert.equal(m.phase, "fight");

        assert.ok(act(m, index, "jab"));
    }
});
test("recovery rejects repeated keys and same-tick spam and resets for a second knockdown", () => {
    const m = fight();

    knockdown(m, 0);

    assert.ok(act(m, 0, "jab"));

    assert.equal(act(m, 0, "cross"), false);

    advance(m, 3);

    assert.equal(act(m, 0, "jab"), false);

    assert.ok(act(m, 0, "cross"));

    knockdown(m, 0);

    assert.equal(m.recovery, 0);

    assert.equal(m.recoverySide, null);

    assert.equal(m.recoveryTicks, 600);
});
test("timer uses health decision and supports draws", () => {
    const m = fight();

    m.remaining = 1;

    m.fighters[0].hp = 70;

    step(m);

    assert.equal(m.winner, 1);

    assert.equal(m.reason, "Time decision");

    const draw = fight();

    draw.remaining = 1;

    step(draw);

    assert.equal(draw.winner, null);
});
test("fixed inputs produce deterministic state", () => {
    const a = fight(),
        b = fight();

    for (let i = 0; i < 400; i++) {
        if (i % 45 === 0) {
            act(a, 0, "jab");

            act(b, 0, "jab");
        }

        if (i % 65 === 0) {
            act(a, 1, "cross");

            act(b, 1, "cross");
        }

        step(a);

        step(b);
    }

    assert.deepEqual(a, b);
});
test("all AI profiles attack and hard attacks more often over a fixed simulation", () => {
    const counts = {};

    for (const difficulty of ["easy", "medium", "hard"]) {
        const m = fight(),
            bot = new Bot(difficulty, 123);

        let attacks = 0,
            prev = "";

        for (let i = 0; i < 1200; i++) {
            m.fighters[0].hp = 100;

            bot.update(m);

            const action = m.fighters[1].action;

            if (action in ATTACKS && action !== prev) attacks++;

            prev = action;

            step(m);
        }

        counts[difficulty] = attacks;

        assert.ok(attacks > 5);
    }

    assert.ok(counts.hard > counts.easy, JSON.stringify(counts));
});
test("easy and medium allow an opening and only roll defense once per incoming attack", () => {
    for (const difficulty of ["easy", "medium"]) {
        const m = fight(),
            bot = new Bot(difficulty, 123);

        bot.update(m);

        const opening = difficulty === "easy" ? 72 : 36;

        for (let i = 0; i < opening - 1; i++) {
            step(m);

            bot.update(m);

            assert.equal(m.fighters[1].action, "idle");
        }

        m.fighters[0].x = 200;

        m.fighters[1].x = 800;

        m.fighters[0].action = "hook";

        m.fighters[0].age = 35;

        let rolls = 0;

        bot.random = () => {
            rolls++;

            return 0.99;
        };

        m.tick = 1000;

        for (let i = 0; i < 50; i++) {
            m.tick++;

            m.fighters[0].age++;

            bot.update(m);
        }

        assert.equal(rolls, 1, `${difficulty} gets one chance, not 50 defensive rolls`);

        m.fighters[0].age = 0;

        bot.update(m);

        m.fighters[0].age = 35;

        bot.update(m);

        assert.equal(rolls, 2);
    }
});
test("easy never unleashes an ultimate, even with a full meter", () => {
    const m = fight(),
        bot = new Bot("easy", 321);

    m.fighters[1].charge = MAX_CHARGE;

    for (let i = 0; i < 1800; i++) {
        m.fighters[0].hp = MAX_HP;

        bot.update(m);

        assert.notEqual(m.fighters[1].action, "ultimate");

        step(m);
    }
});
test("malformed and invalid player actions cannot change combat", () => {
    const m = fight();

    assert.equal(act(m, 7, "jab"), false);

    assert.equal(act(m, 0, "damage"), false);

    assert.equal(m.fighters[1].hp, MAX_HP);
});

test("both fighters start with 135 health and a two-minute round", () => {
    assert.deepEqual(
        createMatch().fighters.map((f) => f.hp),
        [135, 135]
    );
    assert.equal(ROUND_SECONDS, 120);
    assert.equal(createMatch().remaining, 120 * FPS);
});
test("getting hit first preserves the punch animation but makes it miss for either player", () => {
    for (const attacker of [0, 1]) {
        const m = fight(),
            late = 1 - attacker;

        act(m, late, "hook");

        act(m, attacker, "jab");

        advance(m, 7);

        assert.equal(m.fighters[late].action, "hook");

        assert.equal(m.fighters[late].interrupted, true);

        advance(m, 20);

        assert.equal(m.fighters[late].action, "hook");

        assert.equal(m.fighters[attacker].hp, MAX_HP);

        assert.ok(m.events.some((e) => e.target === attacker && e.kind === "miss"));
    }
});
test("a punch entered during hurt and hitstop still animates and misses", () => {
    const m = fight();

    act(m, 1, "jab");

    advance(m, 7);

    assert.ok(m.hitstop > 0);

    assert.ok(act(m, 0, "cross"));

    assert.equal(m.fighters[0].action, "cross");

    advance(m, 24);

    assert.equal(m.fighters[1].hp, MAX_HP);

    assert.ok(m.events.some((e) => e.target === 1 && e.kind === "miss"));
});
test("damage charges both fighters and ultimate requires and spends a full meter", () => {
    const m = fight();

    assert.equal(act(m, 0, "ultimate"), false);

    act(m, 0, "jab");

    advance(m, 7);

    assert.equal(m.fighters[0].charge, 9);

    assert.equal(m.fighters[1].charge, 6);

    advance(m, 40);

    m.fighters[0].charge = MAX_CHARGE;

    assert.ok(act(m, 0, "ultimate"));

    assert.equal(m.fighters[0].charge, 0);

    advance(m, 28);

    assert.equal(m.fighters[1].hp, MAX_HP - 6 - 18);

    assert.equal(m.fighters[0].charge, 0);

    assert.equal(act(m, 0, "ultimate"), false);
});
test("ultimate can be interrupted and still completes its animation", () => {
    const m = fight();

    m.fighters[0].charge = MAX_CHARGE;

    act(m, 0, "ultimate");

    act(m, 1, "jab");

    advance(m, 40);

    assert.equal(m.fighters[0].action, "ultimate");

    assert.equal(m.fighters[1].hp, MAX_HP);

    assert.equal(m.events.at(-1).kind, "miss");
});
test("charge caps and resets with a new match", () => {
    const m = fight();

    m.fighters[0].charge = 99;

    m.fighters[1].charge = 99;

    act(m, 0, "jab");

    advance(m, 7);

    assert.equal(m.fighters[0].charge, 100);

    assert.equal(m.fighters[1].charge, 100);

    assert.equal(createMatch().fighters[0].charge, 0);
});

test("ultimate lands a lighter uppercut followed by three tiny combo hits only once each", () => {
    const m = fight();

    m.fighters[0].charge = 100;

    act(m, 0, "ultimate");

    advance(m, 110);

    assert.deepEqual(
        m.events.map((e) => e.damage),
        [18, 2, 2, 2]
    );

    assert.equal(m.fighters[1].hp, MAX_HP - 24);

    assert.equal(m.fighters[0].hits, 4);

    assert.equal(m.fighters[0].charge, 0);

    assert.equal(m.fighters[0].action, "idle");
});
test("an incoming hit between ultimate strikes makes remaining combo attacks miss", () => {
    const m = fight();

    m.fighters[0].charge = 100;

    act(m, 0, "ultimate");

    advance(m, 28);

    m.hitstop = 0;

    m.fighters[1].action = "idle";

    act(m, 1, "jab");

    advance(m, 7);

    advance(m, 80);

    assert.equal(m.fighters[1].hp, MAX_HP - 18);

    assert.equal(m.events.filter((e) => e.target === 1 && e.kind === "miss").length, 3);
});
test("ultimate followups can be parried and stop the rest of the combo", () => {
    const m = fight();

    m.fighters[0].charge = 100;

    act(m, 0, "ultimate");

    advance(m, 28);

    m.hitstop = 0;

    m.fighters[1].action = "idle";

    advance(m, 9);

    act(m, 1, "block");

    advance(m, 5);

    assert.equal(m.events.at(-1).kind, "parry");

    assert.equal(m.fighters[0].action, "dazed");

    advance(m, 60);

    assert.equal(m.events.filter((e) => e.target === 1).length, 2);
});
test("fighters circle together, face each other, and keep combat distance on a bounded floor", () => {
    const m = fight(),
        before = ringPositions(m);

    advance(m, 300);

    const after = ringPositions(m);

    assert.notDeepEqual(before, after);

    assert.ok(
        Math.abs(
            Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y) -
                (m.fighters[1].x - m.fighters[0].x)
        ) < 0.00001
    );

    for (let i = 0; i < 2; i++) {
        const f = after[i],
            t = after[1 - i];

        assert.ok(Math.cos(f.facing) * (t.x - f.x) + Math.sin(f.facing) * (t.y - f.y) > 0);

        assert.ok(Math.abs(f.x) < 410 && Math.abs(f.y) < 410);
    }

    m.hitstop = 2;

    const orbit = m.orbit;

    step(m);

    assert.equal(m.orbit, orbit);

    m.phase = "finished";

    step(m);

    assert.equal(m.orbit, orbit);
});

test("a full-charge ultimate requested mid-punch executes once after recovery", () => {
    const m = fight();

    m.fighters[0].charge = 100;

    act(m, 0, "jab");

    assert.ok(act(m, 0, "ultimate"));

    assert.equal(m.fighters[0].charge, 100);

    assert.ok(m.fighters[0].ultimateQueuedUntil > 0);

    advance(m, 30);

    assert.equal(m.fighters[0].action, "ultimate");

    assert.equal(m.fighters[0].charge, 0);

    assert.equal(m.fighters[0].ultimateQueuedUntil, 0);
});
test("knockdown clears a queued ultimate", () => {
    const m = fight();

    m.fighters[0].charge = 100;

    act(m, 0, "cross");

    act(m, 0, "ultimate");

    knockdown(m, 0);

    assert.equal(m.fighters[0].ultimateQueuedUntil, 0);
});

test("successive knockdowns require 20, 60, 100, then 200 inputs and remain capped at 200", () => {
    const m = fight();

    for (const goal of [20, 60, 100, 200, 200]) {
        m.fighters[0].hp = 0;

        knockdown(m, 0);

        assert.equal(m.recoveryGoal, goal);

        for (let i = 0; i < goal - 1; i++) {
            assert.ok(act(m, 0, i % 2 ? "cross" : "jab"));

            advance(m, 3);
        }

        assert.equal(m.phase, "knockdown");

        assert.equal(m.fighters[0].hp, 0);

        assert.ok(act(m, 0, (goal - 1) % 2 ? "cross" : "jab"));

        assert.equal(m.phase, "countdown");

        assert.equal(m.fighters[0].hp, GETUP_HP);

        advance(m, 60);
    }

    assert.equal(m.fighters[0].knockdowns, 5);

    knockdown(m, 1);

    assert.equal(m.recoveryGoal, 20);

    assert.equal(m.fighters[1].knockdowns, 1);

    const fresh = createMatch();

    assert.deepEqual(
        fresh.fighters.map((f) => f.knockdowns),
        [0, 0]
    );

    assert.equal(fresh.recoveryGoal, 20);
});

test("25 uninterrupted jabs exhaust stamina; the 26th is rejected without spending", () => {
    const m = fight();

    m.fighters[0].x = 130;

    m.fighters[1].x = 870;

    for (let i = 0; i < 25; i++) {
        m.fighters[0].x = 130;

        m.fighters[1].x = 870;

        assert.ok(act(m, 0, "jab"));

        assert.equal(m.fighters[0].stamina, MAX_STAMINA - (i + 1) * 10);

        advance(m, 20);
    }

    assert.equal(m.fighters[0].stamina, 0);

    assert.equal(act(m, 0, "jab"), false);

    assert.equal(m.fighters[0].action, "idle");
});
test("each attack has a distinct cost, including misses; rejected inputs cost nothing", () => {
    for (const [action, cost] of [
        ["jab", 10],
        ["cross", 15],
        ["hook", 20],
        ["ultimate", 30]
    ]) {
        const m = fight(),
            f = m.fighters[0];

        f.charge = 100;

        f.stamina = cost - 1;

        const before = { ...f };

        assert.equal(act(m, 0, action), false);

        assert.deepEqual(f, before);

        f.stamina = cost;

        assert.ok(act(m, 0, action));

        assert.equal(f.stamina, 0);

        assert.equal(act(m, 0, "jab"), false);

        assert.equal(f.stamina, 0);
    }
});
test("normal regeneration waits after punches, block regenerates three times faster and caps at 250", () => {
    const a = fight(),
        b = fight();

    a.fighters[0].stamina = 20;

    b.fighters[0].stamina = 20;

    assert.ok(act(b, 0, "block"));

    advance(a, 60);

    advance(b, 60);

    assert.ok(Math.abs(a.fighters[0].stamina - 24) < 1e-8);

    assert.ok(Math.abs(b.fighters[0].stamina - 32) < 1e-8);

    a.fighters[0].stamina = MAX_STAMINA - 1;

    advance(a, 60);

    assert.equal(a.fighters[0].stamina, MAX_STAMINA);

    const m = fight();

    m.fighters[0].x = 130;

    m.fighters[1].x = 870;

    act(m, 0, "jab");

    advance(m, 44);

    assert.equal(m.fighters[0].stamina, MAX_STAMINA - 10);

    step(m);

    assert.ok(m.fighters[0].stamina > MAX_STAMINA - 10);
});
test("queued ultimate spends stamina once on execution, not on repeated queue requests", () => {
    const m = fight(),
        f = m.fighters[0];

    f.charge = 100;

    act(m, 0, "jab");

    for (let i = 0; i < 4; i++) assert.ok(act(m, 0, "ultimate"));

    assert.equal(f.stamina, MAX_STAMINA - 10);

    assert.equal(f.charge, 100);

    for (let i = 0; i < 40 && f.action !== "ultimate"; i++) step(m);

    assert.equal(f.action, "ultimate");

    assert.equal(f.stamina, MAX_STAMINA - 40);

    assert.equal(f.charge, 0);
});
test("knockdown freezes stamina and recovery restores it without charging recovery gestures", () => {
    const m = fight();

    m.fighters[0].stamina = 0;

    knockdown(m, 0);

    advance(m, 20);

    assert.equal(m.fighters[0].stamina, 0);

    for (let i = 0; i < 20; i++) {
        assert.ok(act(m, 0, "recover"));

        advance(m, 3);
    }

    assert.equal(m.fighters[0].stamina, MAX_STAMINA);

    assert.equal(m.fighters[1].stamina, MAX_STAMINA);

    const fresh = createMatch();

    assert.deepEqual(
        fresh.fighters.map((f) => f.stamina),
        [MAX_STAMINA, MAX_STAMINA]
    );
});

test("motion fighters can punch and use ultimates at zero stamina while keyboard fighters cannot", () => {
    for (const action of ["jab", "cross", "hook", "ultimate"]) {
        const m = fight(),
            f = m.fighters[0];

        f.stamina = 0;

        f.charge = 100;

        assert.equal(act(m, 0, action), false);

        assert.ok(setInputMode(m, 0, "motion"));

        assert.ok(act(m, 0, action));

        assert.equal(f.stamina, 0);

        assert.equal(m.fighters[1].inputMode, "keyboard");
    }
});
test("switching back to keyboard preserves stamina and restores cost checks", () => {
    const m = fight(),
        f = m.fighters[0];

    f.stamina = 5;

    setInputMode(m, 0, "motion");

    advance(m, 60);

    assert.equal(f.stamina, 5);

    setInputMode(m, 0, "keyboard");

    assert.equal(act(m, 0, "jab"), false);

    act(m, 0, "block");

    advance(m, 60);

    act(m, 0, "block", false);

    assert.ok(act(m, 0, "jab"));

    assert.ok(f.stamina < 10);

    assert.equal(setInputMode(m, 0, "invalid"), false);

    assert.equal(f.inputMode, "keyboard");
});

test("motion hook queues near the end of a jab and executes once", () => {
    const m = fight(),
        f = m.fighters[0];

    setInputMode(m, 0, "motion");

    m.fighters[0].x = 130;

    m.fighters[1].x = 870;

    act(m, 0, "jab");

    advance(m, 8);

    assert.ok(act(m, 0, "hook"));

    const expiry = f.hookQueuedUntil;

    assert.ok(act(m, 0, "hook"));

    assert.equal(f.hookQueuedUntil, expiry);

    advance(m, 12);

    assert.equal(f.action, "hook");

    assert.equal(f.hookQueuedUntil, 0);

    advance(m, 44);

    assert.equal(f.action, "idle");

    assert.equal(f.stamina, MAX_STAMINA);
});
test("stale motion hooks expire and knockdown or keyboard switch clears queued hooks", () => {
    for (const scenario of ["expire", "knockdown", "keyboard"]) {
        const m = fight(),
            f = m.fighters[0];

        setInputMode(m, 0, "motion");

        m.fighters[0].x = 130;

        m.fighters[1].x = 870;

        act(m, 0, "cross");

        assert.ok(act(m, 0, "hook"));

        if (scenario === "expire") {
            advance(m, 40);

            assert.equal(f.action, "idle");
        }

        if (scenario === "knockdown") knockdown(m, 0);

        if (scenario === "keyboard") setInputMode(m, 0, "keyboard");

        assert.equal(f.hookQueuedUntil, 0);
    }
});
