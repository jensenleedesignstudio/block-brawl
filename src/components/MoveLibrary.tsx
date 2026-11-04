// ============================================================
// MOVE LIBRARY INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useState } from "react";
import { ATTACKS, FPS, STAMINA_COST, type Attack } from "../../shared/combat";
import { BoxerArt, type BoxerPose } from "./BoxerArt";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const moves: {
    id: string;
    name: string;
    key: string;
    category: "Attack" | "Defense";
    pose: BoxerPose;
    description: string;
    camera: string;
    attack?: Attack;
}[] = [
    {
        id: "jab",
        name: "JAB",
        key: "J",
        category: "Attack",
        pose: "jab",
        attack: "jab",
        description:
            "A quick straight punch. Use it to interrupt openings and catch a ducking opponent.",
        camera: "Straighten your left arm, then return to guard."
    },
    {
        id: "cross",
        name: "CROSS",
        key: "K",
        category: "Attack",
        pose: "jab",
        attack: "cross",
        description: "follow a jab with a cross when you spot an opening.",
        camera: "Straighten your right arm, then return to guard."
    },
    {
        id: "hook",
        name: "HOOK",
        key: "L",
        category: "Attack",
        pose: "hook",
        attack: "hook",
        description: "your heaviest normal punch. catches slips; ducks avoid it.",
        camera: "Quickly sweep your right fist inward across your chest with a bent elbow, then return to guard."
    },
    {
        id: "ultimate",
        name: "RISING BREAKER",
        key: "R",
        category: "Attack",
        pose: "uppercut",
        attack: "ultimate",
        description: "fill your charge meter for an uppercut and three quick hits.",
        camera: "Rapidly raise one hand above your head; keep the other lower."
    },
    {
        id: "block",
        name: "GUARD",
        key: "SPACE",
        category: "Defense",
        pose: "block",
        description:
            "Absorbs 80% of damage. Time it just before impact to parry and daze your opponent.",
        camera: "Bring both hands up into a guard beside your head."
    },
    {
        id: "dodge",
        name: "SLIP",
        key: "A / D",
        category: "Defense",
        pose: "guard",
        description: "Avoid straight punches by slipping sideways. Stay alert: hooks catch slips.",
        camera: "Move your head and shoulders left or right together."
    },
    {
        id: "duck",
        name: "DUCK",
        key: "S",
        category: "Defense",
        pose: "duck",
        description: "Get below crosses and hooks. A jab can still catch you while you duck.",
        camera: "Bend your knees to lower your head."
    }
];

// ------------------------------------------------------------
// MOVE LIBRARY
// ------------------------------------------------------------

export function MoveLibrary ({ motion }: { motion: boolean }) {
    const [filter, setFilter] = useState("All"),
        [selected, setSelected] = useState("jab");

    const visible = moves.filter((m) => filter === "All" || m.category === filter);

    const active = moves.find((m) => m.id === selected)!;

    const attack = active.attack ? ATTACKS[active.attack] : null;

    return (
        <section
            className="move-library detailed-panel"
            id="moves"
            aria-labelledby="move-library-title"
        >
            <div className="detail-heading">
                <div>
                    <span className="eyebrow">FIELD MANUAL / 02</span>
                    <h2 id="move-library-title">THE FIGHTER’S TOOLKIT.</h2>
                </div>
                <span className="panel-stamp">07 MOVES / TWO WAYS TO PLAY</span>
            </div>
            <div className="library-layout">
                <div className="move-picker">
                    <div className="library-filters" role="group" aria-label="Filter moves">
                        {["All", "Attack", "Defense"].map((f) => (
                            <button
                                key={f}
                                aria-pressed={filter === f}
                                onClick={() => {
                                    setFilter(f);

                                    if (f !== "All" && active.category !== f)
                                        setSelected(moves.find((m) => m.category === f)!.id);
                                }}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="move-buttons">
                        {visible.map((m) => (
                            <button
                                key={m.id}
                                aria-pressed={selected === m.id}
                                onClick={() => setSelected(m.id)}
                            >
                                <kbd>{m.key}</kbd>
                                <span>
                                    {m.name}
                                    <small>{m.category}</small>
                                </span>
                                <span className="move-arrow">↗</span>
                            </button>
                        ))}
                    </div>
                </div>
                <article key={active.id} className={`move-detail demo-${active.id}`}>
                    <div className={`move-display ${active.id === "cross" ? "mirrored" : ""}`}>
                        <span className="diagram-crosshair" />
                        <BoxerArt pose={active.pose} />
                        <span className="move-index">
                            {String(moves.indexOf(active) + 1).padStart(2, "0")} / 07
                        </span>
                        <span className="move-category">{active.category.toUpperCase()}</span>
                    </div>
                    <div className="move-explanation">
                        <div className="move-title">
                            <h3>{active.name}</h3>
                            <kbd>{active.key}</kbd>
                        </div>
                        <p>{active.description}</p>
                        <dl className="move-specs">
                            <div>
                                <dt>DAMAGE</dt>
                                <dd>
                                    {active.attack === "ultimate"
                                        ? "18 + 3 × 2"
                                        : attack
                                          ? attack.damage
                                          : "—"}
                                </dd>
                            </div>
                            <div>
                                <dt>STARTUP</dt>
                                <dd>
                                    {attack
                                        ? `${Math.round((attack.startup / FPS) * 1000)} ms`
                                        : "—"}
                                </dd>
                            </div>
                            <div>
                                <dt>{motion ? "CAMERA COST" : "STAMINA"}</dt>
                                <dd>
                                    {motion
                                        ? "FREE"
                                        : active.attack
                                          ? STAMINA_COST[active.attack]
                                          : 0}
                                </dd>
                            </div>
                        </dl>
                        <div className="camera-instruction">
                            <span className="eyebrow">CAMERA TECHNIQUE</span>
                            <p>{active.camera}</p>
                        </div>
                        {active.attack === "ultimate" && (
                            <small className="move-note">
                                Requires 100% ultimate charge. Each strike can be interrupted.
                            </small>
                        )}
                    </div>
                </article>
            </div>
        </section>
    );
}
