// ============================================================
// FIGHT MENU INTERFACE
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { useEffect, useRef } from "react";

// ------------------------------------------------------------
// FIGHT MENU
// ------------------------------------------------------------

export function FightMenu ({
    online,
    fullscreenHint,
    onResume,
    onExit,
    onLeaveMatch,
    onFullscreen
}: {
    online: boolean;
    fullscreenHint: boolean;
    onResume: () => void;
    onExit: () => void;
    onLeaveMatch: () => void;
    onFullscreen: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null),
        resume = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const node = dialog.current;

        node?.showModal();

        resume.current?.focus();

        return () => node?.close();
    }, []);

    return (
        <dialog
            ref={dialog}
            className="fight-menu"
            aria-labelledby="fight-menu-title"
            onCancel={(e) => {
                e.preventDefault();

                onResume();
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onResume();
            }}
        >
            <section>
                <span className="eyebrow">YOUR CORNER</span>
                <h2 id="fight-menu-title">{online ? "FIGHT MENU" : "TIME OUT"}</h2>
                <p>
                    {online
                        ? "the match keeps going while this menu is open."
                        : "take a breath. your match is paused."}
                </p>
                <button ref={resume} className="primary full" onClick={onResume}>
                    RESUME
                </button>
                {fullscreenHint && (
                    <button className="secondary full" onClick={onFullscreen}>
                        ENTER FULLSCREEN
                    </button>
                )}
                <button className="secondary full" onClick={onExit}>
                    EXIT FULLSCREEN
                </button>
                <button className="secondary full leave-match" onClick={onLeaveMatch}>
                    EXIT MATCH
                </button>
                <small>tap the timer to open this menu.</small>
            </section>
        </dialog>
    );
}
