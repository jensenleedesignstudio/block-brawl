// ============================================================
// COMBAT RULES AND MATCH SIMULATION
// ============================================================

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

/** Fixed-step, serializable combat rules shared by the client and authoritative server. */
export type Action =
    | "recover"
    | "ultimate"
    | "jab"
    | "cross"
    | "hook"
    | "block"
    | "dodgeLeft"
    | "dodgeRight"
    | "duck";
export type Attack = "ultimate" | "jab" | "cross" | "hook";
export type InputMode = "keyboard" | "motion";
export type Difficulty = "easy" | "medium" | "hard";


// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

export const ACTIONS: Action[] = [
    "recover",
    "ultimate",
    "jab",
    "cross",
    "hook",
    "block",
    "dodgeLeft",
    "dodgeRight",
    "duck"
];
export const FPS = 60;
export const MAX_HP = 135;
export const ROUND_SECONDS = 120;
export const MAX_CHARGE = 100;
export const MAX_STAMINA = 250;
export const STAMINA_COST: Record<Attack, number> = { jab: 10, cross: 15, hook: 20, ultimate: 30 };
export const STAMINA_REGEN = { normal: 4, block: 12, delay: 45 } as const;
export const RECOVERY_GOALS = [20, 60, 100, 200] as const;
export const RECOVERY_GOAL = RECOVERY_GOALS[0];
export const GETUP_HP = 60;
export const ULTIMATE_STRIKES = [
    { frame: 28, damage: 18 },
    { frame: 42, damage: 2 },
    { frame: 50, damage: 2 },
    { frame: 58, damage: 2 }
] as const;
export const ATTACKS = {
    ultimate: { startup: 28, active: 32, recovery: 24, damage: 18, range: 190 },
    jab: { startup: 7, active: 5, recovery: 8, damage: 6, range: 158 },
    cross: { startup: 13, active: 6, recovery: 12, damage: 11, range: 171 },
    hook: { startup: 19, active: 7, recovery: 18, damage: 16, range: 148 }
};


// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export type Movement = -1 | 0 | 1;
export interface Fighter {
    x: number;
    hp: number;
    inputMode: InputMode;
    stamina: number;
    staminaDelay: number;
    knockdowns: number;
    charge: number;
    interrupted: boolean;
    strikes: number;
    ultimateQueuedUntil: number;
    hookQueuedUntil: number;
    guard: number;
    guardBroken: boolean;
    action: Action | "idle" | "hurt" | "dazed";
    age: number;
    cooldown: number;
    hit: boolean;
    blockHeld: boolean;
    movement: Movement;
    hits: number;
    damage: number;
}
export interface HitEvent {
    id: number;
    x: number;
    target: number;
    kind: "hit" | "block" | "parry" | "miss";
    damage: number;
    tick: number;
}
export interface Match {
    fighters: [Fighter, Fighter];
    tick: number;
    orbit: number;
    ringX: number;
    ringY: number;
    remaining: number;
    phase: "countdown" | "fight" | "knockdown" | "finished";
    countdown: number;
    down: number | null;
    recovery: number;
    recoveryGoal: number;
    recoveryTicks: number;
    recoverySide: number | null;
    recoveryLastTick: number;
    winner: number | null;
    reason: string;
    hitstop: number;
    events: HitEvent[];
    eventId: number;
}


// ------------------------------------------------------------
// CREATE A FRESH MATCH AND RESET BOTH FIGHTERS
// ------------------------------------------------------------

export function createMatch (): Match {

    const fighter = (x: number): Fighter => ({
        x,
        hp: MAX_HP,
        inputMode: "keyboard",
        stamina: MAX_STAMINA,
        staminaDelay: 0,
        knockdowns: 0,
        charge: 0,
        interrupted: false,
        strikes: 0,
        ultimateQueuedUntil: 0,
        hookQueuedUntil: 0,
        guard: 100,
        guardBroken: false,
        action: "idle",
        age: 0,
        cooldown: 0,
        hit: false,
        blockHeld: false,
        movement: 0,
        hits: 0,
        damage: 0
    });

    return {
        fighters: [fighter(300), fighter(700)],
        tick: 0,
        orbit: 0,
        ringX: 0,
        ringY: 0,
        remaining: ROUND_SECONDS * FPS,
        phase: "countdown",
        countdown: 3 * FPS,
        down: null,
        recovery: 0,
        recoveryGoal: RECOVERY_GOAL,
        recoveryTicks: 0,
        recoverySide: null,
        recoveryLastTick: -10,
        winner: null,
        reason: "",
        hitstop: 0,
        events: [],
        eventId: 0
    };
}


// ------------------------------------------------------------
// SWITCH BETWEEN KEYBOARD AND CAMERA INPUT
// ------------------------------------------------------------

/** Switching controls preserves the keyboard stamina balance. */
export function setInputMode (m: Match, index: number, mode: InputMode): boolean {

    if (!m.fighters[index] || (mode !== "keyboard" && mode !== "motion")) return false;

    m.fighters[index].inputMode = mode;

    if (mode === "keyboard") m.fighters[index].hookQueuedUntil = 0;

    return true;
}


// ------------------------------------------------------------
// CHECK WHETHER AN ACTION IS A PUNCH
// ------------------------------------------------------------

export function isAttack (action: string): action is Attack {

    return Object.hasOwn(ATTACKS, action);
}


// ------------------------------------------------------------
// APPLY FORWARD OR BACKWARD MOVEMENT
// ------------------------------------------------------------

export function move (m: Match, index: number, direction: Movement): boolean {

    const f = m.fighters[index];

    if (!f || (direction !== -1 && direction !== 0 && direction !== 1)) return false;

    f.movement = m.phase === "fight" ? direction : 0;

    return true;
}


// ------------------------------------------------------------
// VALIDATE INPUT AND START THE REQUESTED ACTION
// ------------------------------------------------------------

export function act (m: Match, index: number, action: Action, held = true): boolean {

    const f = m.fighters[index];

    if (!f || !ACTIONS.includes(action)) return false;

    if (action === "recover") return held ? recover(m, index, null) : false;

    if (m.phase === "knockdown")
        return held && (action === "jab" || action === "cross")
            ? recover(m, index, action === "jab" ? 0 : 1)
            : false;

    if (action === "block" && !held) {

        f.blockHeld = false;

        if (f.action === "block") {

            f.action = "idle";

            f.age = 0;
        }

        return true;
    }

    if (m.phase !== "fight" || (m.hitstop > 0 && !isAttack(action))) return false;

    if (f.inputMode !== "motion" && isAttack(action) && f.stamina < STAMINA_COST[action])
        return false;

    if (action === "ultimate" && f.charge < MAX_CHARGE) return false;

    if (
        action === "ultimate" &&
        f.action !== "ultimate" &&
        f.action !== "dazed" &&
        ((f.action !== "idle" && f.action !== "hurt") || f.cooldown > 0)
    ) {

        f.ultimateQueuedUntil = m.tick + 45;

        f.blockHeld = false;

        if (f.action === "block") {

            f.action = "idle";

            f.age = 0;
        }

        return true;
    }

    // Motion classifiers can recognize the next hook before a straight punch
    // finishes. Buffer it briefly rather than silently discard the gesture.
    if (
        action === "hook" &&
        f.inputMode === "motion" &&
        isAttack(f.action) &&
        f.action !== "ultimate"
    ) {

        if (!f.hookQueuedUntil) f.hookQueuedUntil = m.tick + 18;

        return true;
    }

    if (action === "block") {

        if (f.guardBroken || f.guard < 20) return false;

        f.blockHeld = true;

        if (f.action === "block") return true;
    }

    const punchingWhileHurt = isAttack(action) && f.action === "hurt";

    if (!punchingWhileHurt && (f.action !== "idle" || f.cooldown > 0)) return false;

    // Spend only when the attack actually starts, never for rejected/queued input.
    if (f.inputMode !== "motion" && isAttack(action)) {

        f.stamina = Math.max(0, f.stamina - STAMINA_COST[action]);

        f.staminaDelay = STAMINA_REGEN.delay;
    }

    if (action === "hook") f.hookQueuedUntil = 0;

    if (action === "ultimate") f.hookQueuedUntil = 0;

    f.interrupted = punchingWhileHurt;

    if (action === "ultimate") {

        f.charge = 0;

        f.ultimateQueuedUntil = 0;
    }

    f.action = action;

    f.age = 0;

    f.hit = false;

    f.strikes = 0;

    return true;
}


// ------------------------------------------------------------
// COUNT GET-UP INPUTS AND RESTORE THE DOWNED FIGHTER
// ------------------------------------------------------------

export function recover (m: Match, index: number, side: 0 | 1 | null): boolean {

    if (
        m.phase !== "knockdown" ||
        m.down !== index ||
        m.recoveryTicks <= 0 ||
        (side !== null && m.recoverySide === side) ||
        m.tick - m.recoveryLastTick < 3
    )
        return false;

    if (side !== null) m.recoverySide = side;

    m.recoveryLastTick = m.tick;

    m.recovery++;

    if (m.recovery >= m.recoveryGoal) {

        m.fighters[index].hp = GETUP_HP;

        for (const f of m.fighters) {

            f.action = "idle";

            f.age = 0;

            f.cooldown = 0;

            f.hit = false;

            f.interrupted = false;

            f.blockHeld = false;

            f.movement = 0;

            f.guard = 100;

            f.guardBroken = false;

            f.stamina = MAX_STAMINA;

            f.staminaDelay = 0;

            f.hookQueuedUntil = 0;
        }

        m.down = null;

        m.phase = "countdown";

        m.countdown = FPS;

        m.hitstop = 0;
    }

    return true;
}


// ------------------------------------------------------------
// START THE REFEREE COUNT AND CLEAR ACTIVE ACTIONS
// ------------------------------------------------------------

export function knockdown (m: Match, index: number) {

    const count = ++m.fighters[index].knockdowns;

    m.recoveryGoal = RECOVERY_GOALS[Math.min(count - 1, RECOVERY_GOALS.length - 1)];

    m.phase = "knockdown";

    m.down = index;

    m.recovery = 0;

    m.recoveryTicks = 10 * FPS;

    m.recoverySide = null;

    m.recoveryLastTick = m.tick - 3;

    m.hitstop = 0;

    for (const f of m.fighters) {

        f.action = "idle";

        f.age = 0;

        f.blockHeld = false;

        f.movement = 0;

        f.ultimateQueuedUntil = 0;

        f.hookQueuedUntil = 0;
    }
}


// ------------------------------------------------------------
// RECORD THE WINNER AND END THE MATCH
// ------------------------------------------------------------

export function finish (m: Match, winner: number | null, reason: string) {

    m.phase = "finished";

    m.winner = winner;

    m.reason = reason;
}


// ------------------------------------------------------------
// ADVANCE COMBAT BY ONE FIXED SIMULATION TICK
// ------------------------------------------------------------

export function step (m: Match): void {

    if (m.phase === "finished") return;

    m.tick++;

    if (m.phase === "knockdown") {

        if (--m.recoveryTicks <= 0) finish(m, 1 - m.down!, "Knockout");

        return;
    }

    if (m.phase === "countdown") {

        if (--m.countdown <= 0) m.phase = "fight";

        return;
    }

    if (--m.remaining <= 0) {

        finish(
            m,
            m.fighters[0].hp === m.fighters[1].hp
                ? null
                : m.fighters[0].hp > m.fighters[1].hp
                  ? 0
                  : 1,
            "Time decision"
        );

        return;
    }

    if (m.hitstop > 0) {

        m.hitstop--;

        return;
    }

    for (const f of m.fighters) {

        f.staminaDelay = Math.max(0, f.staminaDelay - 1);

        const resting =
            f.action === "idle" ||
            f.action === "duck" ||
            f.action === "dodgeLeft" ||
            f.action === "dodgeRight";

        const guarding = f.action === "block" && !f.guardBroken && f.guard > 0;

        if (f.inputMode !== "motion" && (guarding || (resting && f.staminaDelay === 0)))
            f.stamina = Math.min(
                MAX_STAMINA,
                f.stamina + (guarding ? STAMINA_REGEN.block : STAMINA_REGEN.normal) / FPS
            );

        f.age++;

        f.cooldown = Math.max(0, f.cooldown - 1);

        if (f.action === "block") {

            f.guard = Math.max(0, f.guard - 0.8);

            if (f.guard === 0) {

                f.action = "idle";

                f.age = 0;

                f.blockHeld = false;

                f.guardBroken = true;

                f.cooldown = 24;
            }
        }

        else f.guard = Math.min(100, f.guard + 0.42);

        if (f.guardBroken && f.guard >= 45) f.guardBroken = false;

        const duration = isAttack(f.action)
            ? ATTACKS[f.action].startup + ATTACKS[f.action].active + ATTACKS[f.action].recovery
            : f.action === "dazed"
              ? 48
              : f.action === "hurt"
                ? 14
                : f.action === "duck"
                  ? 32
                  : 27;

        if (f.action !== "idle" && f.action !== "block" && f.age >= duration) {

            const defended = !isAttack(f.action) && f.action !== "hurt";

            f.action = "idle";

            f.age = 0;

            if (defended) f.cooldown = 22;
        }

        if (
            f.action === "idle" &&
            f.blockHeld &&
            !f.guardBroken &&
            f.guard >= 20 &&
            f.cooldown === 0
        ) {

            f.action = "block";

            f.age = 0;
        }
    }

    for (let i = 0; i < 2; i++) {

        const f = m.fighters[i];

        if (f.ultimateQueuedUntil && m.tick > f.ultimateQueuedUntil) f.ultimateQueuedUntil = 0;

        if (f.hookQueuedUntil && m.tick > f.hookQueuedUntil) f.hookQueuedUntil = 0;

        if (f.ultimateQueuedUntil && f.action === "idle" && f.cooldown === 0) act(m, i, "ultimate");

        if (f.hookQueuedUntil && f.action === "idle" && f.cooldown === 0) act(m, i, "hook");
    }

    // Both fighters circle the same bounded floor space while facing each other.
    // Advance on simulation frames so online clients share the same footwork.
    const mobile = m.fighters.filter(
        (f) => f.action === "idle" || f.action === "block" || f.action.startsWith("dodge")
    ).length;

    const slip = m.fighters.reduce(
        (n, f, i) =>
            n +
            (f.action === "dodgeLeft" ? 1 : f.action === "dodgeRight" ? -1 : 0) *
                (i === 0 ? 1 : -1),
        0
    );

    m.orbit += mobile * 0.0025 + slip * 0.006;

    m.ringX = Math.sin(m.orbit * 0.7) * 38;

    m.ringY = Math.sin(m.orbit * 1.1) * 26;

    // Camera body movement takes priority over automatic approach.
    for (let i = 0; i < 2; i++) {

        const f = m.fighters[i],
            opponent = m.fighters[1 - i],
            facing = i === 0 ? 1 : -1;

        const canMove =
            f.action === "idle" ||
            f.action === "block" ||
            f.action === "dodgeLeft" ||
            f.action === "dodgeRight";

        const direction = canMove ? f.movement : 0;

        if (direction) {

            const next = f.x + facing * direction * 3;

            f.x =
                i === 0
                    ? Math.max(130, Math.min(opponent.x - 80, next))
                    : Math.min(870, Math.max(opponent.x + 80, next));
        }

        else if (
            (f.action === "idle" || f.action === "block") &&
            opponent.x - f.x > 135 &&
            i === 0
        ) {

            f.x += Math.min(1.7, (opponent.x - f.x - 135) / 2);
        }

        else if (
            (f.action === "idle" || f.action === "block") &&
            f.x - opponent.x > 135 &&
            i === 1
        ) {

            f.x -= Math.min(1.7, (f.x - opponent.x - 135) / 2);
        }
    }

    for (let i = 0; i < 2; i++) {

        const f = m.fighters[i],
            t = m.fighters[1 - i];

        if (!isAttack(f.action)) continue;

        const a = ATTACKS[f.action];

        const combo = f.action === "ultimate";

        const strike = combo ? ULTIMATE_STRIKES[f.strikes] : null;

        if (
            combo
                ? !strike || f.age < strike.frame
                : f.hit || f.age < a.startup || f.age >= a.startup + a.active
        )
            continue;

        const strikeDamage = strike?.damage ?? a.damage;

        const followup = combo && f.strikes > 0;

        f.hit = true;

        f.strikes++;

        const dodge =
            (t.action === "dodgeLeft" || t.action === "dodgeRight") &&
            t.age >= 3 &&
            t.age <= 20 &&
            f.action !== "hook";

        const duck = t.action === "duck" && t.age >= 4 && t.age <= 27 && f.action !== "jab";

        const missed = f.interrupted || Math.abs(f.x - t.x) > a.range || dodge || duck;

        const blocked = t.action === "block";

        const parried = !missed && blocked && t.age <= 12;

        const damage =
            missed || parried ? 0 : blocked ? Math.ceil(strikeDamage * 0.2) : strikeDamage;

        m.events.push({
            id: ++m.eventId,
            x: t.x,
            target: 1 - i,
            kind: missed ? "miss" : parried ? "parry" : blocked ? "block" : "hit",
            damage,
            tick: m.tick
        });

        m.events = m.events.slice(-12);

        if (!missed) {

            t.hp = Math.max(0, t.hp - damage);

            if (f.action !== "ultimate") f.charge = Math.min(MAX_CHARGE, f.charge + damage * 1.5);

            t.charge = Math.min(MAX_CHARGE, t.charge + damage);

            f.damage += damage;

            if (!parried) f.hits++;

            t.x = Math.max(
                130,
                Math.min(870, t.x + (i === 0 ? 1 : -1) * (followup ? 2 : blocked ? 6 : 18))
            );

            m.hitstop = parried ? 7 : followup ? 1 : blocked ? 2 : 5;

            if (parried) {

                t.guard = Math.max(0, t.guard - 3);

                f.action = "dazed";

                f.age = 0;

                f.blockHeld = false;
            }

            else if (blocked) t.guard = Math.max(0, t.guard - 9);

            else if (isAttack(t.action)) {

                if (!t.hit || t.action === "ultimate") t.interrupted = true;
            }

            else {

                t.action = "hurt";

                t.age = 0;
            }

            if (t.hp <= 0) {

                knockdown(m, 1 - i);

                return;
            }
        }
    }
}
export const LABELS: Record<Action | "idle" | "hurt" | "dazed", string> = {
    recover: "Get up",
    ultimate: "Rising Breaker",
    jab: "Jab",
    cross: "Cross",
    hook: "Hook",
    block: "Guard up",
    dodgeLeft: "Slip left",
    dodgeRight: "Slip right",
    duck: "Duck",
    idle: "In stance",
    hurt: "Hit!",
    dazed: "Dazed!"
};



// ------------------------------------------------------------
// PLACE BOTH FIGHTERS AROUND THE SHARED RING
// ------------------------------------------------------------

/** Floor coordinates and facing used by the moving first-person arena. */
export function ringPositions (m: Match) {

    const radius = Math.abs(m.fighters[1].x - m.fighters[0].x) / 2;

    return m.fighters.map((_, i) => {

        const angle = m.orbit + i * Math.PI;

        return {
            x: m.ringX + Math.cos(angle) * radius,
            y: m.ringY + Math.sin(angle) * radius,
            facing: angle + Math.PI
        };
    });
}
