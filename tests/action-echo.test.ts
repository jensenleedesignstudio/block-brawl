import { test } from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../shared/combat";
import { ActionEchoTracker } from "../src/game/action-echo";

test("action echoes observe every accepted attack/defense without mutating the match", () => {
    const match = createMatch();
    match.phase = "fight";
    const tracker = new ActionEchoTracker();
    for (const action of [
        "jab",
        "cross",
        "hook",
        "block",
        "duck",
        "dodgeLeft",
        "dodgeRight",
        "ultimate"
    ] as const) {
        match.fighters[0].action = action;
        match.fighters[0].age = 0;
        const before = JSON.stringify(match);
        const echo = tracker.sample(match, 0);
        assert.equal(echo?.action, action);
        assert.ok(echo?.pose);
        assert.equal(JSON.stringify(match), before);
    }
});

test("held guard and hitstop never repeat an echo; a fresh same-action move does", () => {
    const match = createMatch();
    match.phase = "fight";
    match.fighters[0].action = "block";
    const tracker = new ActionEchoTracker();
    const first = tracker.sample(match, 0)!;
    for (let tick = 0; tick < 60; tick++) {
        match.tick++;
        if (tick > 10) match.fighters[0].age++;
        assert.equal(tracker.sample(match, 0), null);
    }
    match.fighters[0].age = 0;
    assert.ok(tracker.sample(match, 0)!.id > first.id);
});

test("echoes follow the local viewpoint and exclude idle, hurt, countdown and recovery", () => {
    const match = createMatch();
    const tracker = new ActionEchoTracker();
    match.fighters[0].action = "jab";
    assert.equal(tracker.sample(match, 0), null);
    match.phase = "fight";
    assert.equal(tracker.sample(match, 1), null, "opponent input cannot create your echo");
    match.fighters[1].action = "cross";
    assert.equal(tracker.sample(match, 1)?.label, "CROSS");
    match.fighters[1].action = "hurt";
    assert.equal(tracker.sample(match, 1), null);
    match.phase = "knockdown";
    match.fighters[1].action = "jab";
    assert.equal(tracker.sample(match, 1), null);
});
