/** Presentation budget only. Simulation and input never wait for a paint. */
export class RenderBudget {
    scale = 1;
    private lastPaint = -Infinity;
    private lastChange = 0;
    private average = 0;

    shouldPaint (now: number): boolean {
        // High-refresh monitors otherwise repeat the expensive scene up to 240 times/s.
        const interval = 1000 / 60;
        if (!Number.isFinite(this.lastPaint)) {
            this.lastPaint = now;
            return true;
        }
        const elapsed = now - this.lastPaint;
        if (elapsed < interval - 0.5) return false;
        this.lastPaint += interval * Math.max(1, Math.floor(elapsed / interval));
        return true;
    }

    record (milliseconds: number, now: number, frameMilliseconds = 0): void {
        // Canvas submission can be quick while GPU work delays the next frame.
        const cost = Math.max(milliseconds, Math.min(frameMilliseconds, 50) - 1000 / 60);
        this.average = this.average ? this.average * 0.9 + cost * 0.1 : cost;
        if (now - this.lastChange < 1500) return;
        if (this.average > 12 && this.scale > 0.5) {
            this.scale -= 0.25;
            this.lastChange = now;
        } else if (this.average < 5 && this.scale < 1 && now - this.lastChange > 5000) {
            this.scale += 0.25;
            this.lastChange = now;
        }
    }
}
