// ============================================================
// FIGHT TELEMETRY INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Match } from "../../shared/combat";
import { LABELS } from "../../shared/combat";

// ------------------------------------------------------------
// FIGHT TELEMETRY
// ------------------------------------------------------------

export function FightTelemetry ({
    match,
    names,
    viewIndex,
    playing
}: {
    match: Match;
    names: [string, string];
    viewIndex: 0 | 1;
    playing: boolean;
}) {
    const self = match.fighters[viewIndex],
        rival = match.fighters[1 - viewIndex];

    const events = match.events.slice(-3).reverse();

    return (
        <details className="fight-telemetry" aria-label="Live fight dashboard">
            <summary className="telemetry-heading">
                <span>
                    <i className="live-dot" /> {playing ? "ROUND TELEMETRY" : "YOUR CORNER"}
                </span>
                <small>
                    {playing
                        ? `${self.hits} HITS / ${self.damage} DAMAGE · EXPAND +`
                        : "ROUND STATS · EXPAND +"}
                </small>
            </summary>
            <div className="telemetry-grid">
                <div className="telemetry-numbers">
                    <div>
                        <span>HITS LANDED</span>
                        <b>{self.hits.toString().padStart(2, "0")}</b>
                        <small>RIVAL {rival.hits}</small>
                    </div>
                    <div>
                        <span>DAMAGE DEALT</span>
                        <b>{self.damage.toString().padStart(3, "0")}</b>
                        <small>RIVAL {rival.damage}</small>
                    </div>
                    <div>
                        <span>KNOCKDOWNS</span>
                        <b>{self.knockdowns.toString().padStart(2, "0")}</b>
                        <small>RIVAL {rival.knockdowns}</small>
                    </div>
                </div>
                <div className="telemetry-charge">
                    <div>
                        <span>RISING BREAKER</span>
                        <b>{Math.floor(self.charge)}%</b>
                    </div>
                    <div
                        className="detail-meter"
                        role="meter"
                        aria-label="Your ultimate charge"
                        aria-valuenow={Math.floor(self.charge)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <i style={{ width: `${self.charge}%` }} />
                    </div>
                    <p>
                        {self.charge >= 100
                            ? "FULL CHARGE / PRESS R TO UNLEASH"
                            : "Land punches or take damage to build charge."}
                    </p>
                    <small>
                        {playing
                            ? `CURRENT / ${LABELS[self.action]}`
                            : "FIRST TO THE OPENING. LAST ONE STANDING."}
                    </small>
                </div>
            </div>
            <div className="ringside-feed">
                <span>RINGSIDE</span>
                {events.length ? (
                    events.map((e) => (
                        <span key={e.id} className={`feed-event ${e.kind}`}>
                            <i />
                            {e.kind === "miss"
                                ? "PUNCH MISSED"
                                : `${names[e.target]} · ${e.kind === "parry" ? "PERFECT BLOCK" : e.kind === "block" ? "GUARDED" : `−${e.damage} HP`}`}
                        </span>
                    ))
                ) : (
                    <p>Stay loose. Keep your guard up. Find your rhythm.</p>
                )}
            </div>
        </details>
    );
}
