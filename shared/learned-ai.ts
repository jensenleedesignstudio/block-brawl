// ============================================================
// TRAINED OPPONENT CONNECTION AND DECISIONS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { Bot } from "./ai.js";
import { move, recover, type Match, type Difficulty } from "./combat.js";
import {
    POLICY_VERSION,
    POLICY_ACTIONS,
    policyObservation,
    policyMask,
    applyPolicyAction
} from "./learning.js";

// ------------------------------------------------------------
// LEARNED BOT
// ------------------------------------------------------------

/** Asynchronous inference: rendering never waits on a model request. */
export class LearnedBot extends Bot {
    status: "connecting" | "ready" | "unavailable" = "connecting";
    private pending = false;
    private decisionAt = 0;
    private retryAt = 0;
    private queued: { match: Match; tick: number; readyAt: number; action: number } | null = null;
    private nextAttackAt = 0;
    private current: Match | null = null;
    constructor (
        difficulty: Difficulty,
        seed: number,
        private readonly modelUrl = "http://127.0.0.1:8766"
    ) {
        super(difficulty, seed);
    }
    override update (m: Match, index = 1) {
        this.current = m;

        if (m.phase !== "fight") {
            this.queued = null;

            this.nextAttackAt = 0;

            if (this.difficulty !== "hard") super.update(m, index);
            else if (
                m.phase === "knockdown" &&
                m.down === index &&
                m.recoveryTicks < 510 &&
                m.tick % 4 === 0
            )
                recover(m, index, null);

            return;
        }

        const pacing =
            this.difficulty === "easy"
                ? { decision: 30, reaction: 12, attackGap: 105, maxAge: 24 }
                : this.difficulty === "medium"
                  ? { decision: 15, reaction: 6, attackGap: 54, maxAge: 18 }
                  : { decision: 2, reaction: 0, attackGap: 0, maxAge: 12 };

        const attackIds = [1, 2, 3, 11];

        if (this.queued && m.tick >= this.queued.readyAt) {
            const q = this.queued;

            this.queued = null;

            if (q.match === m && m.tick - q.tick <= pacing.maxAge) {
                const action = q.action;

                const allowed =
                    !attackIds.includes(action) ||
                    (m.tick >= this.nextAttackAt && !(this.difficulty === "easy" && action === 11));

                if (allowed && applyPolicyAction(m, index, action) && attackIds.includes(action))
                    this.nextAttackAt = m.tick + pacing.attackGap;
            }
        }

        if (this.status !== "ready") {
            move(m, index, 0);
        }

        if (this.pending || this.queued || m.tick < this.decisionAt || m.tick < this.retryAt)
            return;

        this.pending = true;

        this.decisionAt = m.tick + pacing.decision;

        const tick = m.tick;

        const controller = new AbortController();

        const timeout = setTimeout(() => controller.abort(), 400);

        const mask = policyMask(m, index);

        for (const id of attackIds)
            if (m.tick < this.nextAttackAt || (this.difficulty === "easy" && id === 11))
                mask[id] = false;

        void fetch(`${this.modelUrl}/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
                version: POLICY_VERSION,
                difficulty: this.difficulty,
                observation: policyObservation(m, index),
                action_mask: mask
            })
        })
            .then(async (response) => {
                if (!response.ok) throw Error("Model unavailable");

                return response.json() as Promise<{ version: number; action: number }>;
            })
            .then((result) => {
                if (
                    result.version !== POLICY_VERSION ||
                    !Number.isInteger(result.action) ||
                    result.action < 0 ||
                    result.action >= POLICY_ACTIONS.length
                )
                    throw Error("Invalid model output");

                this.status = "ready";

                if (this.current === m)
                    this.queued = {
                        match: m,
                        tick,
                        readyAt: tick + pacing.reaction,
                        action: result.action
                    };
            })
            .catch(() => {
                this.status = "unavailable";

                this.retryAt = m.tick + 120;
            })
            .finally(() => {
                clearTimeout(timeout);

                this.pending = false;
            });
    }
}
