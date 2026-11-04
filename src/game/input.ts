import type { Socket } from "socket.io-client";

/** Keep the existing tracking timeout, but apply it to capture time, not arrival time. */
export function isFreshPose (capturedAt: number, now: number, validAfter: number): boolean {
    return capturedAt >= validAfter && now - capturedAt <= 650 && now >= capturedAt;
}

/** UI controls and browser shortcuts must never double as combat inputs. */
export function isGameKey (event: KeyboardEvent): boolean {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
    const target = event.target as HTMLElement | null;
    return !target?.closest?.(
        "input, textarea, select, button, a, summary, [role='button'], [contenteditable]:not([contenteditable='false'])"
    );
}

/** Socket.IO buffers ordinary emits while disconnected; combat must not replay later. */
export function emitGameInput (socket: Socket | null, event: "action" | "movement", data: unknown) {
    if (socket?.connected) socket.emit(event, data);
}
