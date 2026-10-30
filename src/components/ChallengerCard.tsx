// ============================================================
// CHALLENGER CARD INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { BoxerArt } from "./BoxerArt";

// ------------------------------------------------------------
// CHALLENGER CARD
// ------------------------------------------------------------

export function ChallengerCard ({
    name,
    difficulty,
    online,
    learned = false
}: {
    name: string;
    difficulty: "easy" | "medium" | "hard";
    online: boolean;
    learned?: boolean;
}) {
    const ranks = { easy: "01", medium: "02", hard: "03" };
    const rank = learned ? "ML" : ranks[difficulty];

    return (
        <section className="challenger-card" aria-label="Next challenger">
            <div className="cabinet-label">
                <span>★</span> NEXT CHALLENGER <span>★</span>
            </div>
            <div key={name} className="challenger-art">
                <span className="challenger-rank">
                    {online ? "ONLINE RIVAL" : `CIRCUIT / ${rank}`}
                </span>
                <BoxerArt pose="guard" />
                <div className="challenger-name">{name}</div>
            </div>
        </section>
    );
}
