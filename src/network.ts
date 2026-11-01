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

/** Client and server versions are locked together by package-lock.json. */
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

    // Load from the frontend's assets so backend startup cannot time out a
    // separate script download. Socket.IO handles reconnects to the server.
    client ??= import("socket.io-client")
        .then(({ io }) => io)
        .catch(() => {
            client = undefined;
            throw new Error("Cannot load multiplayer controls. Refresh the page and try again.");
        });

    return client;
}
