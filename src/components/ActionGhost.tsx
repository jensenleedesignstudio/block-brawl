import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Match } from "../../shared/combat";
import { ActionEchoTracker } from "../game/action-echo";
import { placeActionGhost } from "../game/ghost-placement";
import { BoxerArt } from "./BoxerArt";

type Echo = NonNullable<ReturnType<ActionEchoTracker["sample"]>> & { x: number; y: number };

/** A short-lived visual echo of your actual move; independent of combat and rendering. */
export function ActionGhost ({
    matchRef,
    viewIndex,
    paused
}: {
    matchRef: MutableRefObject<Match>;
    viewIndex: 0 | 1;
    paused: boolean;
}) {
    const [echo, setEcho] = useState<Echo | null>(null);
    const tracker = useRef(new ActionEchoTracker());
    const layer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let frame = 0;
        const observe = () => {
            if (!paused) {
                const next = tracker.current.sample(matchRef.current, viewIndex);
                if (next && layer.current) {
                    const bounds = layer.current.getBoundingClientRect();
                    const panels = document.querySelectorAll<HTMLElement>(
                        ".site-header, .fight-hud, .party-camera, .camera-overhang, " +
                            ".ring-map, .fight-telemetry, .setup-panel, .corner-toggle, .ultimate-controls" +
                            ", .combat-feedback, .ultimate-title"
                    );
                    const obstacles = Array.from(panels)
                        .filter(
                            (panel) =>
                                panel.getClientRects().length &&
                                getComputedStyle(panel).visibility !== "hidden" &&
                                getComputedStyle(panel).opacity !== "0"
                        )
                        .map((panel) => {
                            const box = panel.getBoundingClientRect();
                            return {
                                left: box.left - bounds.left,
                                top: box.top - bounds.top,
                                right: box.right - bounds.left,
                                bottom: box.bottom - bounds.top
                            };
                        });
                    const position = placeActionGhost(
                        bounds.width,
                        bounds.height,
                        window.innerWidth <= 760,
                        obstacles
                    );
                    setEcho(position ? { ...next, ...position } : null);
                }
            }
            frame = requestAnimationFrame(observe);
        };
        const clear = () => setEcho(null);
        window.addEventListener("resize", clear);
        document.addEventListener("toggle", clear, true);
        frame = requestAnimationFrame(observe);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", clear);
            document.removeEventListener("toggle", clear, true);
        };
    }, [matchRef, viewIndex, paused]);

    return (
        <div className="action-ghost-layer" ref={layer} aria-hidden="true">
            {echo && (
                <div
                    key={echo.id}
                    className={`action-ghost action-ghost-${echo.action}`}
                    aria-hidden="true"
                    style={{
                        animationPlayState: paused ? "paused" : "running",
                        left: echo.x,
                        top: echo.y,
                        bottom: "auto"
                    }}
                    onAnimationEnd={(event) => {
                        if (event.target === event.currentTarget) setEcho(null);
                    }}
                >
                    <div className="ghost-figure">
                        <BoxerArt pose={echo.pose} className="ghost-trail ghost-trail-far" />
                        <BoxerArt pose={echo.pose} className="ghost-trail ghost-trail-near" />
                        <BoxerArt pose={echo.pose} className="ghost-lead" />
                    </div>
                    <span>YOUR MOVE</span>
                    <b>{echo.label}</b>
                </div>
            )}
        </div>
    );
}
