import type { Match } from "../../shared/combat";
import type { BoxerPose } from "../components/BoxerArt";

const poses: Partial<Record<Match["fighters"][0]["action"], { pose: BoxerPose; label: string }>> = {
    jab: { pose: "jab", label: "JAB" },
    cross: { pose: "jab", label: "CROSS" },
    hook: { pose: "hook", label: "HOOK" },
    block: { pose: "block", label: "BLOCK" },
    duck: { pose: "duck", label: "DUCK" },
    dodgeLeft: { pose: "guard", label: "SLIP LEFT" },
    dodgeRight: { pose: "guard", label: "SLIP RIGHT" },
    ultimate: { pose: "uppercut", label: "RISING BREAKER" }
};

/** Read-only presentation observer: accepted fighter actions, never raw key presses. */
export class ActionEchoTracker {
    private action: string | null = null;
    private age = -1;
    private sequence = 0;

    sample (match: Match, index: 0 | 1) {
        if (match.phase !== "fight") {
            this.action = null;
            this.age = -1;
            return null;
        }
        const fighter = match.fighters[index];
        const fresh = fighter.action !== this.action || fighter.age < this.age;
        this.action = fighter.action;
        this.age = fighter.age;
        const art = poses[fighter.action];
        return fresh && art ? { ...art, action: fighter.action, id: ++this.sequence } : null;
    }
}
