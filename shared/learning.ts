// ============================================================
// TRAINING OBSERVATIONS AND ALLOWED ACTIONS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { act, move, MAX_HP, MAX_STAMINA, MAX_CHARGE, ROUND_SECONDS, FPS, type Match } from "./combat.js";



// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

export const POLICY_VERSION = 1;
export const POLICY_ACTIONS = [
    "wait",
    "jab",
    "cross",
    "hook",
    "block",
    "release",
    "dodgeLeft",
    "dodgeRight",
    "duck",
    "advance",
    "retreat",
    "ultimate"
] as const;
const poses = [
    "idle",
    "jab",
    "cross",
    "hook",
    "ultimate",
    "block",
    "dodgeLeft",
    "dodgeRight",
    "duck",
    "hurt",
    "dazed",
    "recover"
];
const clamp = (n: number) => Math.max(0, Math.min(1, n));


// ------------------------------------------------------------
// BUILD NORMALIZED FEATURES FOR THE CURRENT FIGHTER
// ------------------------------------------------------------

/** Same normalized, viewpoint-relative features in training and live inference. */
export function policyObservation (m: Match, index: number): number[] {

    const result = [
        clamp(Math.abs(m.fighters[0].x - m.fighters[1].x) / 740),
        clamp(m.remaining / (ROUND_SECONDS * FPS)),
        clamp(m.hitstop / 8)
    ];

    for (const i of [index, 1 - index]) {

        const f = m.fighters[i];

        result.push(
            clamp(f.hp / MAX_HP),
            clamp(f.stamina / MAX_STAMINA),
            clamp(f.guard / 100),
            clamp(f.charge / MAX_CHARGE),
            clamp(f.age / 120),
            clamp(f.cooldown / 120),
            clamp(f.staminaDelay / 60),
            clamp(f.knockdowns / 5),
            Number(f.guardBroken),
            Number(f.interrupted),
            Number(f.hit),
            Number(f.blockHeld),
            Number(f.inputMode === "motion"),
            clamp((i === 0 ? f.x - 130 : 870 - f.x) / 740),
            (f.movement + 1) / 2,
            clamp(f.strikes / 4)
        );

        result.push(...poses.map((p) => Number(p === f.action)));
    }

    return result;
}


// ------------------------------------------------------------
// TRY A POLICY ACTION AGAINST THE CURRENT RULES
// ------------------------------------------------------------

function candidate (m: Match, index: number, id: number): boolean {

    const action = POLICY_ACTIONS[id],
        f = m.fighters[index];

    if (!action || m.phase !== "fight") return action === "wait";

    if (action === "wait") return move(m, index, 0);

    if (action === "release") return act(m, index, "block", false);

    if (action === "advance" || action === "retreat") {

        if (!["idle", "block", "dodgeLeft", "dodgeRight"].includes(f.action)) return false;

        return move(m, index, action === "advance" ? 1 : -1);
    }

    move(m, index, 0);

    if (action !== "block") act(m, index, "block", false);

    return act(m, index, action) && f.action === action;
}


// ------------------------------------------------------------
// CHECK WHICH POLICY ACTIONS ARE CURRENTLY ALLOWED
// ------------------------------------------------------------

export function policyMask (m: Match, index: number): boolean[] {

    return POLICY_ACTIONS.map((_, id) => id === 0 || candidate(structuredClone(m), index, id));
}


// ------------------------------------------------------------
// APPLY POLICY ACTION
// ------------------------------------------------------------

export function applyPolicyAction (m: Match, index: number, id: number): boolean {

    if (!Number.isInteger(id) || id < 0 || id >= POLICY_ACTIONS.length || !policyMask(m, index)[id])
        return false;

    return candidate(m, index, id);
}
