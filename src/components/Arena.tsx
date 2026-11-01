// ============================================================
// GAME LOOP, LIVE HUD, AND MATCH EFFECTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { ArrowUpRight } from "lucide-react";
import { PixelIcon } from "./PixelIcon";
import {
    LABELS,
    MAX_HP,
    MAX_CHARGE,
    MAX_STAMINA,
    STAMINA_COST,
    step,
    type Match
} from "../../shared/combat";
import { Bot } from "../../shared/ai";
import { ArenaPresentation } from "../game/presentation";
import { renderArena } from "../game/renderer";
import { artworkStatus, retryArtwork } from "../game/artwork-loading";
import { prepareGymArtwork } from "../game/gym-photography";
import { sound } from "../game/audio";
import { FightTelemetry } from "./FightTelemetry";
import { ActionGhost } from "./ActionGhost";
import { RingMap } from "./RingMap";

// ------------------------------------------------------------
// LIVE MATCH LOOP AND ARENA INTERFACE
// ------------------------------------------------------------

export function Arena ({
    matchRef,
    botRef,
    playing,
    online,
    viewIndex,
    names,
    muted,
    onMute,
    onFinish,
    paused,
    onFullscreen,
    onUltimate,
    onMenu,
    menuOpen,
    aiStatus
}: {
    matchRef: MutableRefObject<Match>;
    botRef: MutableRefObject<Bot | null>;
    playing: boolean;
    online: boolean;
    viewIndex: 0 | 1;
    names: [string, string];
    muted: boolean;
    onMute: () => void;
    onFinish: () => void;
    paused: boolean;
    onFullscreen?: () => void;
    onUltimate: () => void;
    onMenu: () => void;
    menuOpen: boolean;
    aiStatus?: string;
}) {
    // ------------------------------------------------------------
    // CANVAS, HUD SNAPSHOTS, AND CURRENT PROPS
    // ------------------------------------------------------------

    const canvas = useRef<HTMLCanvasElement>(null),
        container = useRef<HTMLDivElement>(null);

    const [hud, setHud] = useState(() => structuredClone(matchRef.current));
    const [artwork, setArtwork] = useState(() => {
        prepareGymArtwork();
        return artworkStatus();
    });

    const latest = useRef({ playing, online, viewIndex, muted, onFinish, paused });

    latest.current = { playing, online, viewIndex, muted, onFinish, paused };

    // ------------------------------------------------------------
    // FIXED COMBAT TICKS AND SMOOTH PRESENTATION FRAMES
    // ------------------------------------------------------------

    useEffect(() => {
        let raf = 0,
            last = performance.now(),
            acc = 0,
            lastUI = 0,
            eventId = 0,
            ended = false,
            phase = "countdown",
            poseTick = -1,
            poseTime = 0,
            animationTime = 0;

        const presentation = new ArenaPresentation();

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

        const draw = (now: number) => {
            const m = matchRef.current,
                opts = latest.current;

            if (m.phase !== "finished") ended = false;

            if (m.eventId < eventId) eventId = 0;

            const elapsed = Math.min(100, now - last);

            last = now;

            if (opts.playing && !opts.online && !opts.paused) {
                acc += elapsed;

                while (acc >= 1000 / 60) {
                    botRef.current?.update(m);

                    step(m);

                    acc -= 1000 / 60;
                }
            } else acc = 0;

            if (!opts.muted && opts.playing) {
                for (const e of m.events) {
                    if (e.id > eventId && e.kind !== "miss") sound(e.kind);
                }

                if (phase === "countdown" && m.phase === "fight") sound("bell");
            }

            phase = m.phase;

            eventId = m.eventId;

            if (m.phase === "finished" && opts.playing && !ended) {
                ended = true;

                opts.onFinish();
            }

            if (m.tick !== poseTick) {
                poseTick = m.tick;

                poseTime = now;
            }

            const frameFraction =
                !opts.playing || opts.paused
                    ? 0
                    : opts.online
                      ? Math.min(2, (now - poseTime) / (1000 / 60))
                      : acc / (1000 / 60);

            if ((!opts.playing || !opts.paused) && !reducedMotion.matches)
                animationTime += elapsed / 1000;

            const visibleMatch = presentation.frame(m, opts.paused ? 0 : elapsed);

            const c = canvas.current?.getContext("2d");

            if (c)
                renderArena(
                    c,
                    visibleMatch,
                    animationTime,
                    !opts.playing,
                    opts.viewIndex,
                    frameFraction,
                    reducedMotion.matches
                );

            if (now - lastUI > 60) {
                setArtwork(artworkStatus());
                setHud(structuredClone(m));

                lastUI = now;
            }

            raf = requestAnimationFrame(draw);
        };

        raf = requestAnimationFrame(draw);

        // ------------------------------------------------------------
        // STOP THE FRAME LOOP WHEN THE ARENA UNMOUNTS
        // ------------------------------------------------------------

        return () => {
            cancelAnimationFrame(raf);
        };
    }, [matchRef, botRef]);

    // ------------------------------------------------------------
    // HUD VALUES AND RECENT HIT FEEDBACK
    // ------------------------------------------------------------

    const seconds = Math.ceil(hud.remaining / 60);

    const feedback = hud.events
        .filter((event) => event.kind !== "miss" && hud.tick - event.tick < 24)
        .slice(-1)[0];

    const ultimateFighter = hud.fighters.findIndex((f) => f.action === "ultimate");

    const cornerClass = (index: number) =>
        `${hud.fighters[index].hp <= MAX_HP * 0.25 ? " low-health" : ""}${feedback?.target === index ? ` feedback-${feedback.kind}` : ""}`;

    return (
        <div className="arena-shell" ref={container}>
            <div className="arena-top">
                <span>
                    <i /> IRON & OAK <small> / GYM CIRCUIT</small>
                </span>
                <div>
                    <button aria-label={muted ? "Enable sound" : "Mute sound"} onClick={onMute}>
                        {muted ? (
                            <PixelIcon name="muted" size={16} />
                        ) : (
                            <PixelIcon name="sound" size={16} />
                        )}
                    </button>
                    <button
                        aria-label="Toggle fullscreen"
                        onClick={
                            onFullscreen ??
                            (() => {
                                if (document.fullscreenElement) void document.exitFullscreen();
                                else void container.current?.requestFullscreen?.();
                            })
                        }
                    >
                        <PixelIcon name="expand" size={15} />
                    </button>
                </div>
            </div>
            <div className="arena-stage">
                {artwork !== "ready" && (
                    <div className="artwork-loading" role="status" aria-live="polite">
                        <span>
                            {artwork === "error"
                                ? "Unable to load arena artwork"
                                : "Loading arena artwork…"}
                        </span>
                        {artwork === "error" && (
                            <button
                                onClick={() => {
                                    retryArtwork();
                                    setArtwork(artworkStatus());
                                }}
                            >
                                Retry artwork
                            </button>
                        )}
                    </div>
                )}
                <canvas
                    ref={canvas}
                    width={2000}
                    height={1160}
                    aria-label="Realistic military boxing gym with pixel-art fighters; the downed boxer kneels during recovery"
                />
                <div className="fight-hud">
                    <div
                        className={`fighter-hud ${viewIndex === 0 ? "self-hud" : "rival-hud"}${cornerClass(0)}`}
                    >
                        <div>
                            <span className="hud-portrait" aria-hidden="true" />
                            <span className="player-badge">P1</span>
                            <b>{names[0]}</b>
                            <span>
                                {Math.ceil(hud.fighters[0].hp)}
                                <small> / {MAX_HP}</small>
                            </span>
                        </div>
                        <div
                            className="health-track"
                            role="meter"
                            aria-label={`${names[0]} health`}
                            aria-valuenow={Math.ceil(hud.fighters[0].hp)}
                            aria-valuemin={0}
                            aria-valuemax={MAX_HP}
                        >
                            <span
                                className="health-echo"
                                style={{ width: `${(hud.fighters[0].hp / MAX_HP) * 100}%` }}
                            />
                            <i style={{ width: `${(hud.fighters[0].hp / MAX_HP) * 100}%` }} />
                        </div>
                        <div
                            className="guard-meter"
                            role="meter"
                            aria-label={`${names[0]} guard`}
                            aria-valuenow={Math.ceil(hud.fighters[0].guard)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <span>GUARD</span>
                            <i>
                                <b style={{ width: `${hud.fighters[0].guard}%` }} />
                            </i>
                            <span>
                                {hud.fighters[0].guardBroken
                                    ? "BROKEN"
                                    : `${Math.ceil(hud.fighters[0].guard)}%`}
                            </span>
                        </div>
                        {hud.fighters[0].inputMode !== "motion" && (
                            <div
                                className={`stamina-meter ${hud.fighters[0].stamina < STAMINA_COST.jab ? "exhausted" : ""}`}
                                role="meter"
                                aria-label={`${names[0]} stamina`}
                                aria-valuenow={Math.floor(hud.fighters[0].stamina)}
                                aria-valuemin={0}
                                aria-valuemax={MAX_STAMINA}
                            >
                                <span>STAMINA</span>
                                <i>
                                    <b
                                        style={{
                                            width: `${(hud.fighters[0].stamina / MAX_STAMINA) * 100}%`
                                        }}
                                    />
                                </i>
                                <span>{Math.floor(hud.fighters[0].stamina)}</span>
                            </div>
                        )}
                        <small>
                            {playing ? LABELS[hud.fighters[0].action] : "RED CORNER"}
                            <span>{hud.fighters[0].hits} HITS</span>
                        </small>
                    </div>
                    <button
                        type="button"
                        className={`timer ${playing && seconds <= 15 ? "timer-critical" : ""}`}
                        onClick={onMenu}
                        disabled={!playing}
                        aria-label="Open fight menu"
                        aria-haspopup="dialog"
                        aria-expanded={menuOpen}
                        title="Click for Resume, Exit Match and Fullscreen"
                    >
                        <small>ROUND 01</small>
                        <strong>
                            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                        </strong>
                        <span>MENU · Ⅱ</span>
                    </button>
                    <div
                        className={`fighter-hud opponent ${viewIndex === 1 ? "self-hud" : "rival-hud"}${cornerClass(1)}`}
                    >
                        <div>
                            <span className="hud-portrait" aria-hidden="true" />
                            <span className="player-badge">P2</span>
                            <b>{names[1]}</b>
                            <span>
                                {Math.ceil(hud.fighters[1].hp)}
                                <small> / {MAX_HP}</small>
                            </span>
                        </div>
                        <div
                            className="health-track"
                            role="meter"
                            aria-label={`${names[1]} health`}
                            aria-valuenow={Math.ceil(hud.fighters[1].hp)}
                            aria-valuemin={0}
                            aria-valuemax={MAX_HP}
                        >
                            <span
                                className="health-echo"
                                style={{ width: `${(hud.fighters[1].hp / MAX_HP) * 100}%` }}
                            />
                            <i style={{ width: `${(hud.fighters[1].hp / MAX_HP) * 100}%` }} />
                        </div>
                        <div
                            className="guard-meter"
                            role="meter"
                            aria-label={`${names[1]} guard`}
                            aria-valuenow={Math.ceil(hud.fighters[1].guard)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <span>GUARD</span>
                            <i>
                                <b style={{ width: `${hud.fighters[1].guard}%` }} />
                            </i>
                            <span>
                                {hud.fighters[1].guardBroken
                                    ? "BROKEN"
                                    : `${Math.ceil(hud.fighters[1].guard)}%`}
                            </span>
                        </div>
                        {hud.fighters[1].inputMode !== "motion" && (
                            <div
                                className={`stamina-meter ${hud.fighters[1].stamina < STAMINA_COST.jab ? "exhausted" : ""}`}
                                role="meter"
                                aria-label={`${names[1]} stamina`}
                                aria-valuenow={Math.floor(hud.fighters[1].stamina)}
                                aria-valuemin={0}
                                aria-valuemax={MAX_STAMINA}
                            >
                                <span>STAMINA</span>
                                <i>
                                    <b
                                        style={{
                                            width: `${(hud.fighters[1].stamina / MAX_STAMINA) * 100}%`
                                        }}
                                    />
                                </i>
                                <span>{Math.floor(hud.fighters[1].stamina)}</span>
                            </div>
                        )}
                        <small>
                            {playing ? LABELS[hud.fighters[1].action] : "BLUE CORNER"}
                            <span>{hud.fighters[1].hits} HITS</span>
                        </small>
                    </div>
                </div>
                {playing && (
                    <div className="ultimate-controls">
                        <button
                            className={
                                hud.fighters[viewIndex].charge >= MAX_CHARGE
                                    ? "ultimate-button ready"
                                    : "ultimate-button"
                            }
                            disabled={
                                paused ||
                                hud.phase !== "fight" ||
                                (hud.fighters[viewIndex].inputMode !== "motion" &&
                                    hud.fighters[viewIndex].stamina < STAMINA_COST.ultimate) ||
                                hud.fighters[viewIndex].charge < MAX_CHARGE ||
                                !["idle", "hurt", "block"].includes(
                                    hud.fighters[viewIndex].action
                                ) ||
                                (hud.fighters[viewIndex].cooldown > 0 &&
                                    hud.fighters[viewIndex].action !== "hurt")
                            }
                            onClick={onUltimate}
                        >
                            <span>
                                RISING BREAKER ·{" "}
                                {hud.fighters[viewIndex].charge >= MAX_CHARGE
                                    ? hud.fighters[viewIndex].inputMode !== "motion" &&
                                      hud.fighters[viewIndex].stamina < STAMINA_COST.ultimate
                                        ? "NEED 30 STAMINA"
                                        : "R / UNLEASH"
                                    : `${Math.floor(hud.fighters[viewIndex].charge)}%`}
                            </span>
                            <i style={{ width: `${hud.fighters[viewIndex].charge}%` }} />
                        </button>
                        {hud.fighters[viewIndex].inputMode !== "motion" &&
                            hud.fighters[viewIndex].stamina < STAMINA_COST.jab &&
                            hud.phase === "fight" && (
                                <span className="stamina-warning">
                                    LOW STAMINA · BLOCK TO RECOVER FASTER
                                </span>
                            )}
                        <span className="opponent-charge">
                            RIVAL ULT · {Math.floor(hud.fighters[1 - viewIndex].charge)}%
                        </span>
                    </div>
                )}
                {playing && aiStatus && aiStatus !== "ready" && (
                    <div className="model-status" role="status">
                        {aiStatus === "unavailable"
                            ? "TRAINED MODEL DISCONNECTED · RECONNECTING"
                            : "CONNECTING TO TRAINED MODEL"}
                    </div>
                )}
                {playing && hud.phase === "fight" && (
                    <ActionGhost matchRef={matchRef} viewIndex={viewIndex} paused={paused} />
                )}
                {playing && feedback && hud.phase === "fight" && (
                    <div
                        key={feedback.id}
                        className={`combat-feedback ${feedback.kind} ${feedback.target === viewIndex ? "received" : "landed"}`}
                        aria-hidden="true"
                    >
                        {feedback.kind === "parry"
                            ? "PERFECT GUARD"
                            : feedback.kind === "block"
                              ? "BLOCKED"
                              : `−${feedback.damage}`}
                        <small>
                            {feedback.kind === "hit"
                                ? feedback.target === viewIndex
                                    ? "GUARD UP"
                                    : "HIT LANDED"
                                : feedback.kind === "parry"
                                  ? "COUNTER WINDOW"
                                  : "GUARD ABSORBED"}
                        </small>
                    </div>
                )}
                {!playing && (
                    <div className="arena-preview-label">
                        <span className="live-dot" /> CHALLENGER APPROACHING{" "}
                        <ArrowUpRight size={13} />
                    </div>
                )}
                {playing && hud.phase === "countdown" && (
                    <div className="round-overlay">
                        <small>ROUND ONE</small>
                        <strong key={Math.ceil(hud.countdown / 60)}>
                            {" "}
                            {Math.ceil(hud.countdown / 60) === 1
                                ? "FIGHT!"
                                : Math.ceil(hud.countdown / 60) === 3
                                  ? "READY"
                                  : "SET"}
                        </strong>
                        <span>NO LIMITS. ALL FIGHT.</span>
                    </div>
                )}
                {playing && !paused && hud.phase === "fight" && ultimateFighter !== -1 && (
                    <div
                        className={`ultimate-cinematic ${ultimateFighter === viewIndex ? "player-ultimate" : "rival-ultimate"}`}
                        aria-hidden="true"
                    >
                        <div className="ultimate-title">
                            <small>
                                {ultimateFighter === viewIndex ? "YOUR FINISHER" : "RIVAL FINISHER"}
                            </small>
                            <b>RISING BREAKER</b>
                            <span>UPPERCUT / RAPID COMBO</span>
                        </div>
                    </div>
                )}
                {playing && hud.phase === "knockdown" && (
                    <div className="knockdown-banner" aria-hidden="true">
                        <small>{hud.down === viewIndex ? "YOUR CORNER" : "RIVAL CORNER"}</small>
                        <b>KNOCKED DOWN!</b>
                    </div>
                )}
                {playing && hud.phase === "knockdown" && (
                    <div className="knockdown-overlay" role="status">
                        <small>{hud.down === viewIndex ? "YOU ARE DOWN" : "OPPONENT DOWN"}</small>
                        <strong key={Math.ceil(hud.recoveryTicks / 60)}>
                            {Math.ceil(hud.recoveryTicks / 60)}
                        </strong>
                        <b>
                            {hud.down === viewIndex ? "FIGHT YOUR WAY BACK" : "THE REF IS COUNTING"}
                        </b>
                        <div
                            className="recovery-track"
                            role="progressbar"
                            aria-label="Get-up progress"
                            aria-valuemin={0}
                            aria-valuemax={hud.recoveryGoal}
                            aria-valuenow={hud.recovery}
                        >
                            <i style={{ width: `${(hud.recovery / hud.recoveryGoal) * 100}%` }} />
                        </div>
                        <span>
                            {hud.recovery} / {hud.recoveryGoal}
                        </span>
                        {hud.down === viewIndex ? (
                            <p>
                                Alternate <kbd>J</kbd> + <kbd>K</kbd> rapidly
                                <br />
                                CAMERA: move either hand UP / DOWN · each clear stroke or top pause
                                counts
                            </p>
                        ) : (
                            <p>Wait for the count. Combat resumes if they get up.</p>
                        )}
                    </div>
                )}
                {playing && paused && (
                    <div className="round-overlay pause">
                        <strong>TIME OUT</strong>
                        <span>
                            {online
                                ? "Reconnecting fighter… match paused for up to 20 seconds."
                                : "Match paused. Click the round timer to resume."}
                        </span>
                    </div>
                )}
            </div>
            <div className="arena-bottom">
                <span>
                    <i className="live-dot" />
                    {playing
                        ? hud.phase === "finished"
                            ? "ROUND COMPLETE"
                            : paused
                              ? "MATCH PAUSED"
                              : "MATCH IN PROGRESS"
                        : "FREE PLAY · PRESS START TO FIGHT"}
                </span>
                <span>
                    {aiStatus ? (
                        `AI / ${aiStatus === "ready" ? "TRAINED MODEL" : aiStatus === "unavailable" ? "MODEL UNAVAILABLE" : "CONNECTING"}`
                    ) : (
                        <>
                            CIRCLING <b>ON</b>
                        </>
                    )}
                </span>
            </div>
            <div className="ringside-rail">
                <RingMap match={hud} viewIndex={viewIndex} />
                <FightTelemetry match={hud} names={names} viewIndex={viewIndex} playing={playing} />
            </div>
        </div>
    );
}
