// ============================================================
// CIRCUIT ROSTER INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Difficulty } from "../../shared/combat";
import { BoxerArt } from "./BoxerArt";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const roster = [
    {
        id: "easy" as const,
        name: "ROOKIE",
        title: "THE NEW KID",
        style: "Patient jabs. A little room to breathe.",
        focus: "Learn the rhythm",
        pace: "RELAXED",
        defense: "OCCASIONAL"
    },
    {
        id: "medium" as const,
        name: "AXEL",
        title: "THE COUNTERPUNCHER",
        style: "Mixed combinations and a measured defense.",
        focus: "Read the opening",
        pace: "BALANCED",
        defense: "REACTIVE"
    },
    {
        id: "hard" as const,
        name: "IRON REX",
        title: "THE PRESSURE FIGHTER",
        style: "Fast decisions. Heavy pressure. Few free shots.",
        focus: "Make every counter count",
        pace: "RELENTLESS",
        defense: "FREQUENT"
    }
];

// ------------------------------------------------------------
// CIRCUIT ROSTER
// ------------------------------------------------------------

export function CircuitRoster ({
    difficulty,
    disabled,
    onSelect
}: {
    difficulty: Difficulty;
    disabled: boolean;
    onSelect: (d: Difficulty) => void;
}) {
    return (
        <section
            className="circuit-roster detailed-panel"
            id="fighters"
            aria-labelledby="roster-title"
        >
            <div className="detail-heading">
                <div>
                    <span className="eyebrow">CHALLENGER DOSSIERS / 01</span>
                    <h2 id="roster-title">KNOW YOUR OPPOSITION.</h2>
                </div>
                <span className="panel-stamp">IRON & OAK / CPU CIRCUIT</span>
            </div>
            <div className="roster-grid">
                {roster.map((fighter, index) => (
                    <button
                        disabled={disabled}
                        aria-pressed={difficulty === fighter.id}
                        key={fighter.id}
                        className={`roster-card ${difficulty === fighter.id ? "selected" : ""}`}
                        onClick={() => onSelect(fighter.id)}
                    >
                        <div className="roster-art">
                            <span className="roster-number">0{index + 1}</span>
                            <BoxerArt pose={index === 0 ? "guard" : index === 1 ? "jab" : "hook"} />
                            <span className="roster-difficulty">{fighter.id.toUpperCase()}</span>
                        </div>
                        <div className="roster-copy">
                            <small>{fighter.title}</small>
                            <h3>{fighter.name}</h3>
                            <p>{fighter.style}</p>
                            <dl>
                                <div>
                                    <dt>PACE</dt>
                                    <dd>{fighter.pace}</dd>
                                </div>
                                <div>
                                    <dt>DEFENSE</dt>
                                    <dd>{fighter.defense}</dd>
                                </div>
                            </dl>
                            <span className="roster-focus">{fighter.focus}</span>
                        </div>
                        <div className="roster-selection">
                            {difficulty === fighter.id
                                ? "◆ SELECTED CHALLENGER"
                                : "SELECT CHALLENGER →"}
                        </div>
                    </button>
                ))}
            </div>
            {disabled && (
                <p className="roster-lock">
                    Finish your current match or choose VS CPU to change your CPU challenger.
                </p>
            )}
        </section>
    );
}
