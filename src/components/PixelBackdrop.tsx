// ============================================================
// LIVING FIELD-HOUSE BACKDROP
// ============================================================

import { useEffect, useRef } from "react";

export function PixelBackdrop ({ quiet }: { quiet: boolean }) {
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const node = canvas.current;
        const context = node?.getContext("2d");

        if (!node || !context || quiet) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let frame = 0;
        let previous = 0;
        let time = 0;
        let pointer = 0;
        let drift = 0;
        let needsDraw = true;

        // ------------------------------------------------------------
        // LOW RESOLUTION KEEPS THE TIMBER AND DUST CRISP AND LIGHTWEIGHT
        // ------------------------------------------------------------

        const resize = () => {
            needsDraw = true;
            node.width = 480;
            node.height = Math.round((480 * window.innerHeight) / window.innerWidth);
        };

        const move = (event: PointerEvent) => {
            pointer = event.clientX / window.innerWidth - 0.5;
        };

        const draw = (now: number) => {
            frame = requestAnimationFrame(draw);

            if (
                document.hidden ||
                now - previous < 1000 / 20 ||
                (reducedMotion.matches && !needsDraw)
            )
                return;

            needsDraw = false;

            const elapsed = Math.min(100, now - previous);
            previous = now;

            if (!reducedMotion.matches) time += elapsed / 1000;

            drift += ((reducedMotion.matches ? 0 : pointer) - drift) * 0.05;

            const width = node.width;
            const height = node.height;
            const light = context.createLinearGradient(0, 0, width, height);
            light.addColorStop(0, "#9d7746");
            light.addColorStop(0.35, "#39432b");
            light.addColorStop(1, "#18251c");
            context.globalAlpha = 1;
            context.fillStyle = light;
            context.fillRect(0, 0, width, height);
            // Faint timber uprights move gently with the pointer, like the arena.
            for (let index = -1; index < 12; index++) {
                const x = Math.round(index * 48 - drift * 5);
                context.fillStyle = "#151c14";
                context.fillRect(x, 0, 5, height);
                context.fillStyle = "#8c7145";
                context.fillRect(x + 5, 0, 1, height);
            }
            for (let y = 28; y < height; y += 70) {
                context.fillStyle = "#21291b";
                context.fillRect(0, y, width, 5);
                context.fillStyle = "#a3824c";
                context.fillRect(0, y + 5, width, 1);
            }
            // Window light and slow airborne chalk replace the city skyline.
            for (let pane = 0; pane < 4; pane++) {
                context.fillStyle = "#e6c48225";
                context.fillRect(10 + pane * 17, 12, 14, height * 0.6);
            }
            for (let index = 0; index < 30; index++) {
                const x = (index * 83 + Math.sin(time * 0.2 + index) * 10 + width) % width;
                const y = (index * 29 - time * 1.3 + height * 10) % height;
                context.globalAlpha = (Math.sin(time + index) + 1) * 0.2;
                context.fillStyle = "#f4d89a";
                context.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
            context.globalAlpha = 1;
        };

        resize();
        frame = requestAnimationFrame(draw);
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", move, { passive: true });

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", move);
        };
    }, [quiet]);

    return (
        <canvas
            ref={canvas}
            className={`pixel-backdrop${quiet ? " quiet" : ""}`}
            aria-hidden="true"
        />
    );
}
