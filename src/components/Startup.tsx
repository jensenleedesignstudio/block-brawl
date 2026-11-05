import { useEffect, useRef, useState } from "react";
import App from "../App";
import { BoxerArt } from "./BoxerArt";
import { PixelIcon } from "./PixelIcon";
import "../boxer-art.css";
import { artworkStatus, retryArtwork } from "../game/artwork-loading";

/** Decorative cabinet artwork shares the game's existing fighter atlas. */
function StartupGlove () {
    return (
        <svg className="startup-glove" viewBox="0 0 32 36" shapeRendering="crispEdges" aria-hidden="true">
            <path fill="#091a16" d="M8 1h16v3h4v4h3v14h-4v12H9V24H5v-4H1V10h4V5h3z" />
            <path fill="currentColor" d="M9 4h14v3h4v13h-4v5H10v-5H6v-3H4v-6h4V7h1z" />
            <path fill="#fff0b0" opacity=".65" d="M11 7h10v3H11zM8 10h3v6H8z" />
            <path fill="#071c18" opacity=".35" d="M21 10h6v10h-4v5H10v-4h11z" />
            <path fill="#d5bd84" d="M12 26h12v6H12z" />
            <path fill="#647563" d="M15 28h6v2h-6z" />
        </svg>
    );
}

function StartupGear ({ kind }: { kind: "trophy" | "bag" | "star" }) {
    return (
        <svg className={`startup-gear startup-gear-${kind}`} viewBox="0 0 40 48" shapeRendering="crispEdges" aria-hidden="true">
            {kind === "trophy" ? <>
                <path fill="#071d19" d="M5 3h30v5h5v16h-9v5h-6v9h8v8H7v-8h8v-9H9v-5H0V8h5z" />
                <path fill="#ffce45" d="M10 6h20v16h-5v6H15v-6h-5zM3 11h5v10H3zM32 11h5v10h-5zM18 28h4v12h9v4H9v-4h9z" />
                <path fill="#fff3a3" d="M13 9h4v12h-4zM12 40h16v2H12z" />
            </> : kind === "bag" ? <>
                <path fill="#b6c9a2" d="M17 0h3v9h-3zM23 0h3v9h-3z" />
                <path fill="#071d19" d="M11 8h21v4h4v29h-4v5H11v-5H7V12h4z" />
                <path fill="#f17661" d="M12 12h19v29H12z" />
                <path fill="#bb4e66" d="M26 12h5v29h-5z" />
                <path fill="#ffb58b" d="M14 14h3v22h-3z" />
                <path fill="#f9df9c" d="M12 19h19v5H12zM12 32h19v4H12z" />
            </> : <>
                <path fill="#0a201b" d="M17 0h7v9h7v7h9v8h-9v7h-7v10h-7V31h-7v-7H0v-8h10V9h7z" />
                <path fill="currentColor" d="M18 5h4v9h7v5h7v3h-7v5h-7v9h-4v-9h-6v-5H4v-3h8v-5h6z" />
            </>}
        </svg>
    );
}

function StartupBackdrop () {
    return (
        <div className="startup-backdrop" aria-hidden="true">
            <div className="startup-frame" />
            <div className="startup-checkers startup-checkers-top" />
            <div className="startup-checkers startup-checkers-bottom" />
            <div className="startup-rope startup-rope-left" />
            <div className="startup-rope startup-rope-right" />
            <div className="startup-sticker startup-sticker-left"><StartupGear kind="star" /><span>POW!</span></div>
            <div className="startup-sticker startup-sticker-right"><span>K.O.</span><StartupGear kind="star" /></div>
            <div className="startup-extra startup-extra-left"><BoxerArt pose="guard" /><span>PLAYER 01</span></div>
            <div className="startup-extra startup-extra-right"><BoxerArt pose="duck" /><span>CHALLENGER</span></div>
            <div className="startup-marquee"><span>IRON & OAK</span><PixelIcon name="bolt" size={18} /><span>BOXING CLUB</span></div>
            <div className="startup-art-row startup-art-top">
                <BoxerArt pose="jab" />
                <span className="startup-spark"><StartupGear kind="trophy" /></span>
                <span className="startup-glove-red"><StartupGlove /></span>
                <span className="startup-badge">135<small>HP</small></span>
                <span className="startup-glove-gold"><StartupGlove /></span>
                <BoxerArt pose="block" className="startup-rival" />
            </div>
            <div className="startup-art-row startup-art-bottom">
                <span className="startup-glove-gold"><StartupGlove /></span>
                <BoxerArt pose="uppercut" />
                <span className="startup-spark"><StartupGear kind="bag" /></span>
                <span className="startup-badge">ROUND<small>01</small></span>
                <BoxerArt pose="hook" className="startup-rival" />
                <span className="startup-glove-red"><StartupGlove /></span>
            </div>
            <div className="startup-footer"><span>JAB · CROSS · HOOK</span><span>MAKE YOUR MOVE</span></div>
            <div className="startup-confetti">
                {Array.from({ length: 64 }, (_, i) => (
                    <i key={i} style={{ left: `${4 + ((i * 37) % 92)}%`, top: `${i < 32 ? 10 + ((i * 7) % 22) : 72 + ((i * 11) % 18)}%`, width: `${i % 3 === 0 ? 8 : 4}px`, height: `${i % 3 === 0 ? 8 : 4}px` }} />
                ))}
            </div>
        </div>
    );
}

/** Keep the arena mounted and loading behind an explicit, keyboard-accessible entrance. */
export function Startup () {
    const [entered, setEntered] = useState(false);
    const [dissolved, setDissolved] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [status, setStatus] = useState(artworkStatus);
    const enter = useRef<HTMLButtonElement>(null);
    const game = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.getElementById("boot-screen")?.remove();
        enter.current?.focus();
        const poll = window.setInterval(() => setStatus(artworkStatus()), 200);
        return () => window.clearInterval(poll);
    }, []);

    useEffect(() => {
        if (!entered) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const timer = window.setTimeout(() => setDissolved(true), reduced ? 150 : 2600);
        return () => window.clearTimeout(timer);
    }, [entered]);

    useEffect(() => {
        if (!dissolved || status !== "ready") return;
        const timer = window.setTimeout(() => setRevealed(true), 400);
        return () => window.clearTimeout(timer);
    }, [dissolved, status]);

    useEffect(() => {
        if (revealed) game.current?.focus({ preventScroll: true });
    }, [revealed]);

    const leaving = dissolved && status === "ready";
    return (
        <>
            <div ref={game} tabIndex={-1} inert={!revealed} aria-hidden={!revealed}>
                <App />
            </div>
            {!revealed && (
                <section className={`startup ${entered ? "startup-entered" : ""} ${leaving ? "startup-leaving" : ""}`} aria-label="Welcome to Block Brawl">
                    <StartupBackdrop />
                    <h1 className="startup-title" aria-label="Block Brawl">
                        <svg viewBox="0 0 1000 130" aria-hidden="true">
                            <defs>
                                <mask id="startup-dissolve" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="130">
                                    <rect width="1000" height="130" fill="white" />
                                    {Array.from({ length: 650 }, (_, i) => (
                                        <rect key={i} className="startup-pixel" x={(i % 100) * 10} y={Math.floor(i / 100) * 20} width="11" height="21" fill="black" style={{ animationDelay: `${((i * 73) % 211) * 10}ms` }} />
                                    ))}
                                </mask>
                            </defs>
                            <text x="500" y="88" textAnchor="middle" mask="url(#startup-dissolve)">BLOCK BRAWL</text>
                        </svg>
                    </h1>
                    <button ref={enter} className="startup-enter" disabled={entered} onClick={() => setEntered(true)}>ENTER <span aria-hidden="true">↵</span></button>
                    <div className="startup-status" role="status" aria-live="polite">
                        {entered && status === "error" ? (
                            <><p>couldn’t load the arena.</p><button onClick={() => { retryArtwork(); setStatus(artworkStatus()); }}>RETRY</button></>
                        ) : entered && dissolved && status !== "ready" ? "getting the ring ready…" : ""}
                    </div>
                </section>
            )}
        </>
    );
}
