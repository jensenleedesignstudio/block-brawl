// ============================================================
// ONLINE CONNECTION LOADING
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import type { Socket } from "socket.io-client";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

/** Load the client served by Socket.IO itself, keeping server/client versions aligned. */
type SocketFactory = (url?: string, options?: { autoConnect?: boolean }) => Socket;

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

let client: Promise<SocketFactory> | undefined;

// ------------------------------------------------------------
// LOAD SOCKET CLIENT
// ------------------------------------------------------------

export function loadSocketClient (): Promise<SocketFactory> {
    if (window.location.protocol === "file:") {
        return Promise.reject(
            new Error(
                "Run npm install and npm run dev in the project folder, then open http://localhost:5173. Online play and trained CPU fights require the server."
            )
        );
    }

    if (client) return client;

    client = new Promise((resolve, reject) => {
        const script = document.createElement("script");

        const origin = (import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");

        script.src = `${origin}/socket.io/socket.io.js`;

        script.async = true;

        const timeout = window.setTimeout(() => fail(), 12000);

        const fail = () => {
            window.clearTimeout(timeout);

            script.remove();

            client = undefined;

            reject(new Error("Cannot load multiplayer. Start the Node server and try again."));
        };

        script.onerror = fail;

        script.onload = () => {
            window.clearTimeout(timeout);

            const factory = (window as unknown as { io?: SocketFactory }).io;

            if (factory) resolve(factory);
            else fail();
        };

        document.head.append(script);
    });

    return client;
}
