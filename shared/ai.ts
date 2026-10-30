// ============================================================
// CPU OPPONENT DECISIONS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { act, isAttack, MAX_CHARGE, type Match, type Difficulty, type Action } from "./combat.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const PROFILES = {
    easy: { delay: 120, reaction: 30, defense: 0.06, combo: 0, opening: 72 },
    medium: { delay: 72, reaction: 18, defense: 0.18, combo: 0.12, opening: 36 },
    hard: { delay: 19, reaction: 5, defense: 0.72, combo: 0.65, opening: 0 }
};

// ------------------------------------------------------------
// BOT
// ------------------------------------------------------------

export class Bot {
    private next = 0;
    private release = 0;
    private sequence = 0;
    private seed: number;
    private wasFighting = false;
    private observedAction = "";
    private observedAge = -1;
    private threat = 0;
    private checkedThreat = -1;
    constructor (
        public difficulty: Difficulty,
        seed = 42
    ) {
        this.seed = seed;
    }
    private random () {
        this.seed = (this.seed * 1664525 + 1013904223) >>> 0;

        return this.seed / 4294967296;
    }
    update (m: Match, index = 1) {
        if (m.phase !== "fight") this.wasFighting = false;

        if (m.phase === "knockdown" && m.down === index) {
            if (
                m.recoveryTicks < 510 &&
                m.tick % 12 === 0 &&
                this.random() <
                    (this.difficulty === "easy" ? 0.4 : this.difficulty === "medium" ? 0.6 : 0.8)
            )
                act(m, index, m.recoverySide === 0 ? "cross" : "jab");

            return;
        }

        if (m.phase !== "fight") return;

        const f = m.fighters[index],
            opponent = m.fighters[1 - index],
            p = PROFILES[this.difficulty];

        if (!this.wasFighting) {
            this.wasFighting = true;

            this.next = Math.max(this.next, m.tick + p.opening);
        }

        if (opponent.action !== this.observedAction || opponent.age < this.observedAge)
            this.threat++;

        this.observedAction = opponent.action;

        this.observedAge = opponent.age;

        if (m.tick >= this.release) act(m, index, "block", false);

        if (f.action !== "idle" || m.tick < this.next) return;

        if (f.stamina < 25) {
            if (this.difficulty !== "easy" && act(m, index, "block")) this.release = m.tick + 90;

            this.next = m.tick + 90;

            return;
        }

        // Easy/medium get one defensive roll per incoming punch, not a fresh
        // chance every frame that makes even a modest probability almost certain.
        const canReact =
            isAttack(opponent.action) &&
            opponent.age >= p.reaction &&
            (this.difficulty === "hard" || this.checkedThreat !== this.threat);

        let defend = false;

        if (canReact) {
            this.checkedThreat = this.threat;

            defend = this.random() < p.defense;
        }

        if (defend) {
            const defense: Action =
                opponent.action === "hook" ? "duck" : this.random() < 0.65 ? "block" : "dodgeLeft";

            act(m, index, defense);

            this.release = m.tick + 24;

            this.next = m.tick + p.delay;

            return;
        }

        if (Math.abs(f.x - opponent.x) > 175) return;

        const pattern: Action[] =
            this.difficulty === "easy"
                ? ["jab", "jab", "cross"]
                : ["jab", "cross", "hook", "cross"];

        const attack =
            this.difficulty !== "easy" && f.charge >= MAX_CHARGE
                ? "ultimate"
                : this.difficulty === "hard" && opponent.action === "block"
                  ? "hook"
                  : pattern[this.sequence++ % pattern.length];

        act(m, index, attack);

        this.next =
            m.tick +
            (this.random() < p.combo
                ? this.difficulty === "medium"
                    ? 42
                    : 27
                : p.delay + 25 + Math.floor(this.random() * 30));
    }
}
