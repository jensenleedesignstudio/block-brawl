import { useEffect, useRef, useState } from "react";
import App from "../App";
import { artworkStatus, retryArtwork } from "../game/artwork-loading";

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
