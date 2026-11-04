// ============================================================
// ROUND HISTORY INTERFACE
// ============================================================

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export interface RoundRecord {
    id: number;
    opponent: string;
    result: "WIN" | "LOSS" | "DRAW";
    reason: string;
    hits: number;
    damage: number;
}

// ------------------------------------------------------------
// ROUND HISTORY
// ------------------------------------------------------------

export function RoundHistory ({ rounds }: { rounds: RoundRecord[] }) {
    return (
        <section className="round-history detailed-panel" aria-labelledby="history-title">
            <div className="detail-heading">
                <div>
                    <span className="eyebrow">SESSION ARCHIVE / 03</span>
                    <h2 id="history-title">EVERY ROUND TELLS A STORY.</h2>
                </div>
                <span className="panel-stamp">LAST FIVE / THIS SESSION</span>
            </div>
            {rounds.length ? (
                <div className="history-rows">
                    {rounds.map((round, index) => (
                        <article key={round.id}>
                            <span className={`round-result ${round.result.toLowerCase()}`}>
                                {round.result}
                            </span>
                            <div>
                                <b>VS {round.opponent}</b>
                                <small>{round.reason}</small>
                            </div>
                            <span>{round.hits} HITS</span>
                            <span>{round.damage} DAMAGE</span>
                            <small>#{String(rounds.length - index).padStart(2, "0")}</small>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="history-empty">
                    <span aria-hidden="true">◇</span>
                    <div>
                        <h3>YOUR FIRST BELL IS WAITING.</h3>
                        <p>finish a fight to see your result, hits, and damage here.</p>
                    </div>
                    <a href="#arcade">BACK TO THE ARENA ↗</a>
                </div>
            )}
        </section>
    );
}
