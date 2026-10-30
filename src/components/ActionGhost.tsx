import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Match } from "../../shared/combat";
import { ActionEchoTracker } from "../game/action-echo";
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

    useEffect(() => {
        let frame = 0;
        const observe = () => {
            if (!paused) {
                const next = tracker.current.sample(matchRef.current, viewIndex);
                if (next)
                    setEcho({ ...next, x: 8 + Math.random() * 76, y: 28 + Math.random() * 26 });
            }
            frame = requestAnimationFrame(observe);
        };
        frame = requestAnimationFrame(observe);
        return () => cancelAnimationFrame(frame);
    }, [matchRef, viewIndex, paused]);

    if (!echo) return null;
    return (
        <div
            key={echo.id}
            className={`action-ghost action-ghost-${echo.action}`}
            aria-hidden="true"
            style={{
                animationPlayState: paused ? "paused" : "running",
                left: `clamp(32px, ${echo.x}%, calc(100% - 175px))`,
                top: `clamp(150px, ${echo.y}%, calc(100% - 240px))`,
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
    );
}
