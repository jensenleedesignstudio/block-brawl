// ============================================================
// TRAINING ACCESS TO THE REAL COMBAT ENGINE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { createInterface } from "node:readline";
import { Bot } from "../shared/ai.js";
import {
    createMatch,
    step,
    recover,
    setInputMode,
    type Difficulty,
    type InputMode
} from "../shared/combat.js";
import {
    POLICY_ACTIONS,
    POLICY_VERSION,
    policyObservation,
    policyMask,
    applyPolicyAction
} from "../shared/learning.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

let match = createMatch(),
    bot = new Bot("easy"),
    agent = 0,
    opponent: Difficulty = "easy",
    elapsed = 0,
    terminal = false;
const state = () => ({
    observation: policyObservation(match, agent),
    action_mask: policyMask(match, agent),
    info: {
        opponent,
        agent_index: agent,
        tick: match.tick,
        hits: match.fighters[agent].hits,
        damage: match.fighters[agent].damage,
        damage_received: match.fighters[1 - agent].damage,
        result:
            match.phase === "finished"
                ? match.winner === null
                    ? "draw"
                    : match.winner === agent
                      ? "win"
                      : "loss"
                : null,
        reason: match.reason
    }
});

// ------------------------------------------------------------
// ADVANCE
// ------------------------------------------------------------

function advance () {
    bot.update(match, 1 - agent);

    // The learner's recovery is automatic; its policy learns fighting decisions.
    if (
        match.phase === "knockdown" &&
        match.down === agent &&
        match.recoveryTicks < 510 &&
        match.tick % 4 === 0
    )
        recover(match, agent, null);

    step(match);

    elapsed++;
}
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    try {
        const req = JSON.parse(line);

        if (req.command === "describe") {
            console.log(
                JSON.stringify({
                    ok: true,
                    version: POLICY_VERSION,
                    actions: POLICY_ACTIONS,
                    observation_size: policyObservation(match, 0).length
                })
            );

            continue;
        }

        if (req.command === "reset") {
            const seed = Number(req.seed) >>> 0;

            opponent =
                req.opponent === "mixed"
                    ? (["easy", "medium", "hard"] as Difficulty[])[seed % 3]
                    : req.opponent;

            if (!["easy", "medium", "hard"].includes(opponent)) throw Error("Invalid opponent");

            agent = seed % 2;

            match = createMatch();

            bot = new Bot(opponent, seed);

            elapsed = 0;

            terminal = false;

            const mode: InputMode =
                req.opponent_mode === "mixed"
                    ? seed % 4 < 2
                        ? "keyboard"
                        : "motion"
                    : (req.opponent_mode ?? "keyboard");

            if (!["keyboard", "motion"].includes(mode)) throw Error("Invalid input mode");

            setInputMode(match, 1 - agent, mode);

            while (match.phase === "countdown") advance();

            console.log(JSON.stringify({ ok: true, ...state() }));

            continue;
        }

        if (req.command !== "step") throw Error("Unknown command");

        if (terminal) throw Error("Episode finished; reset before stepping again");

        const before = match.fighters[agent].damage - match.fighters[1 - agent].damage;

        const downBefore = match.fighters[1 - agent].knockdowns - match.fighters[agent].knockdowns;

        const accepted = applyPolicyAction(match, agent, req.action);

        for (let n = 0; n < 4 && match.phase !== "finished"; n++) advance();

        while ((match.phase === "countdown" || match.phase === "knockdown") && elapsed < 30000)
            advance();

        const terminated = match.phase === "finished",
            truncated = !terminated && elapsed >= 30000;

        terminal = terminated || truncated;

        const after = match.fighters[agent].damage - match.fighters[1 - agent].damage;

        const downAfter = match.fighters[1 - agent].knockdowns - match.fighters[agent].knockdowns;

        let reward = (after - before) / 20 + (downAfter - downBefore) * 2;

        if (terminated) reward += match.winner === null ? 0 : match.winner === agent ? 10 : -10;

        console.log(
            JSON.stringify({ ok: true, ...state(), reward, terminated, truncated, accepted })
        );
    } catch (error) {
        console.log(
            JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            })
        );
    }
}
