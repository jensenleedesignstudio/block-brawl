// ============================================================
// PUNCH EXTENSION AND ULTIMATE HAND MOVEMENT
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { ATTACKS, ULTIMATE_STRIKES, type Attack } from "../../shared/combat.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const ease = (n: number) => {
    const t = Math.max(0, Math.min(1, n));

    return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------
// PUNCH EXTENSION
// ------------------------------------------------------------

/** Continuous acceleration into contact and a longer, eased return to guard. */
export function punchExtension (attack: Attack, age: number) {
    const contact = ATTACKS[attack].startup;

    const outbound = Math.min(contact, attack === "jab" ? 5 : 7);

    const recovery = Math.min(12, ATTACKS[attack].active + ATTACKS[attack].recovery - 2);

    return age <= contact
        ? ease((age - contact + outbound) / outbound)
        : 1 - ease((age - contact - 1) / recovery);
}

// ------------------------------------------------------------
// ULTIMATE POSE
// ------------------------------------------------------------

export function ultimatePose (age: number) {
    const contact = ULTIMATE_STRIKES[0].frame;

    const upper =
        age < contact - 6
            ? 0
            : age < contact
              ? ease((age - contact + 6) / 6)
              : 1 - ease((age - contact - 2) / 8);

    const combo = ULTIMATE_STRIKES.slice(1).map(({ frame }) =>
        Math.max(0, 1 - Math.abs(age - frame) / 4)
    );

    return {
        upper,
        wind: age < contact - 6 ? ease(age / 14) : 1 - ease((age - contact + 6) / 6),
        left: Math.max(combo[0], combo[2]),
        right: combo[1]
    };
}

// ------------------------------------------------------------
// ULTIMATE HANDS
// ------------------------------------------------------------

/** Opening uppercut uses a single, vertically travelling right fist. */
export function ultimateHands (age: number, firstPerson: boolean) {
    const u = ultimatePose(age);

    return firstPerson
        ? {
              left: [395 + u.left * 92, 407 - u.left * 115] as [number, number],
              right: [605 - u.right * 95, 407 + u.wind * 75 - u.upper * 245 - u.right * 110] as [
                  number,
                  number
              ]
          }
        : {
              left: [-40 + u.left * 33, -185 + u.left * 17] as [number, number],
              right: [40 - u.right * 33, -185 + u.wind * 65 - u.upper * 115 + u.right * 17] as [
                  number,
                  number
              ]
          };
}
