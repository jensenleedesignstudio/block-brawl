// ============================================================
// ONLINE ROOMS AND AUTHORITATIVE MATCH SERVER
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import express from "express";
import { createServer, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Server, type Socket } from "socket.io";
import { startLocalModel } from "./local-model.js";
import {
    ACTIONS,
    act,
    createMatch,
    finish,
    move,
    step,
    setInputMode,
    type InputMode,
    type Action,
    type Match,
    type Movement
} from "../shared/combat.js";

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface Player {
    inputMode: InputMode;
    token: string;
    socketId: string | null;
    name: string;
    ready: boolean;
    disconnectedAt: number | null;
}
interface Room {
    code: string;
    players: Player[];
    match: Match | null;
    created: number;
}

// ------------------------------------------------------------
// CREATE ARENA SERVER
// ------------------------------------------------------------

export function createArenaServer () {
    // ------------------------------------------------------------
    // SERVER, SOCKET CONNECTIONS, AND ROOM STORAGE
    // ------------------------------------------------------------

    const app = express();

    app.disable("x-powered-by");
    app.use((_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        next();
    });

    const http = createServer(app);

    const io = new Server(http, {
        cors: { origin: process.env.CLIENT_ORIGIN?.split(",") ?? false },
        maxHttpBufferSize: 8192
    });

    const rooms = new Map<string, Room>();

    app.get("/api/health", (_req, res) => res.json({ ok: true, rooms: rooms.size }));

    const staticOptions = {
        setHeaders: (res: ServerResponse, filename: string) => {
            // Vite fingerprints these filenames; HTML and unversioned art still revalidate.
            if (/[\\/]assets[\\/][^/\\]+-[\w-]+\.(js|css)$/.test(filename))
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
    };

    app.use(express.static(fileURLToPath(new URL("../../dist", import.meta.url)), staticOptions));

    // The source and built server have different directory depths.
    app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url)), staticOptions));

    const publicRoom = (r: Room) => ({
        code: r.code,
        players: r.players.map((p) => ({ name: p.name, ready: p.ready, connected: !!p.socketId })),
        paused: r.players.some((p) => !p.socketId),
        match: r.match
    });

    const emitRoom = (r: Room) => io.to(r.code).emit("room", publicRoom(r));

    // ------------------------------------------------------------
    // PLAYER DEPARTURE AND ROOM CLEANUP
    // ------------------------------------------------------------

    function leave (socket: Socket) {
        const code = socket.data.code as string | undefined;

        if (!code) return;

        const r = rooms.get(code);

        if (!r) return;

        const index = r.players.findIndex((p) => p.socketId === socket.id);

        if (index < 0) return;

        // A lobby departure frees the seat immediately. Keep match departure rules intact.
        if (!r.match) {
            r.players.splice(index, 1);
            socket.leave(code);
            socket.data.code = undefined;
            if (!r.players.length) rooms.delete(code);
            else {
                r.players.forEach((p, i) => {
                    if (p.socketId)
                        io.to(p.socketId).emit("joined", { code, token: p.token, index: i });
                });
                emitRoom(r);
            }
            return;
        }

        if (r.match && r.match.phase !== "finished") finish(r.match, 1 - index, "Opponent left");

        r.players[index].socketId = null;

        r.players[index].disconnectedAt = Date.now() - 21000;

        socket.leave(code);

        socket.data.code = undefined;

        emitRoom(r);
    }

    io.on("connection", (socket) => {
        let windowStart = Date.now(),
            events = 0;

        socket.use((_packet, next) => {
            if (Date.now() - windowStart > 1000) {
                windowStart = Date.now();

                events = 0;
            }

            if (++events > 45) return;

            next();
        });

        const error = (message: string) => socket.emit("roomError", message);

        socket.on("createRoom", (data: { name?: string } = {}) => {
            if (rooms.size >= 200) return error("Arena is busy. Try again shortly.");

            leave(socket);

            let code = "";

            do {
                code = randomBytes(3).toString("hex").toUpperCase();
            } while (rooms.has(code));

            const p: Player = {
                inputMode: "keyboard",
                token: randomBytes(24).toString("hex"),
                socketId: socket.id,
                name: String(data?.name || "Fighter 1").slice(0, 20),
                ready: false,
                disconnectedAt: null
            };

            const r: Room = { code, players: [p], match: null, created: Date.now() };

            rooms.set(code, r);

            socket.data.code = code;

            socket.join(code);

            socket.emit("joined", { code, token: p.token, index: 0 });

            emitRoom(r);
        });

        socket.on("joinRoom", (data: { code?: string; name?: string; token?: string } = {}) => {
            const code = String(data?.code || "")
                    .trim()
                    .toUpperCase(),
                r = rooms.get(code);

            if (!r) return error("Room not found. Check the six-character code.");

            const existing = r.players.findIndex((p) => p.token === data?.token);

            if (existing >= 0) {
                const p = r.players[existing];

                if (p.socketId && p.socketId !== socket.id)
                    return error("This fighter is already connected.");

                p.socketId = socket.id;

                p.disconnectedAt = null;

                socket.join(code);

                socket.data.code = code;

                socket.emit("joined", { code, token: p.token, index: existing });

                emitRoom(r);

                return;
            }

            if (r.players.length >= 2) return error("This room already has two fighters.");

            leave(socket);

            const p: Player = {
                inputMode: "keyboard",
                token: randomBytes(24).toString("hex"),
                socketId: socket.id,
                name: String(data?.name || "Fighter 2").slice(0, 20),
                ready: false,
                disconnectedAt: null
            };

            r.players.push(p);

            socket.join(code);

            socket.data.code = code;

            socket.emit("joined", { code, token: p.token, index: 1 });

            emitRoom(r);
        });

        socket.on("inputMode", (mode: InputMode) => {
            if (mode !== "keyboard" && mode !== "motion") return;

            const r = rooms.get(socket.data.code);

            if (!r) return;

            const index = r.players.findIndex((p) => p.socketId === socket.id);

            if (index < 0) return;

            r.players[index].inputMode = mode;

            if (r.match) setInputMode(r.match, index, mode);

            emitRoom(r);
        });

        socket.on("ready", (data: { inputMode?: InputMode } = {}) => {
            const r = rooms.get(socket.data.code);

            if (!r || (r.match && r.match.phase !== "finished")) return;

            const p = r.players.find((p) => p.socketId === socket.id);

            if (!p) return;

            if (data?.inputMode === "motion" || data?.inputMode === "keyboard")
                p.inputMode = data.inputMode;

            p.ready = true;

            if (r.players.length === 2 && r.players.every((p) => p.ready && p.socketId)) {
                r.match = createMatch();

                r.players.forEach((p, i) => {
                    setInputMode(r.match!, i, p.inputMode);

                    p.ready = false;
                });
            }

            emitRoom(r);
        });

        socket.on("action", (data: { action?: Action; held?: boolean } = {}) => {
            const r = rooms.get(socket.data.code);

            if (!r?.match || r.players.some((p) => !p.socketId)) return;

            const index = r.players.findIndex((p) => p.socketId === socket.id);

            if (index >= 0 && ACTIONS.includes(data?.action as Action))
                act(r.match, index, data.action!, data.held !== false);
        });

        socket.on("movement", (direction: Movement) => {
            const r = rooms.get(socket.data.code);

            if (!r?.match || r.players.some((p) => !p.socketId)) return;

            const index = r.players.findIndex((p) => p.socketId === socket.id);

            if (index >= 0) move(r.match, index, direction);
        });

        socket.on("leaveRoom", () => leave(socket));

        socket.on("disconnect", () => {
            const r = rooms.get(socket.data.code);

            const p = r?.players.find((p) => p.socketId === socket.id);

            if (r && p) {
                p.socketId = null;

                p.disconnectedAt = Date.now();

                if (r.match)
                    r.match.fighters.forEach((f) => {
                        f.blockHeld = false;

                        f.movement = 0;

                        f.ultimateQueuedUntil = 0;

                        f.hookQueuedUntil = 0;
                    });

                emitRoom(r);
            }
        });
    });

    let frame = 0;

    // ------------------------------------------------------------
    // ADVANCE AND BROADCAST AUTHORITATIVE MATCH STATE
    // ------------------------------------------------------------

    const timer = setInterval(() => {
        frame++;

        for (const [code, r] of rooms) {
            if (
                r.players.every((p) => !p.socketId) &&
                r.players.every((p) => p.disconnectedAt && Date.now() - p.disconnectedAt > 20000)
            ) {
                rooms.delete(code);

                continue;
            }

            if (!r.match && Date.now() - r.created > 3600000) {
                io.to(code).emit("roomError", "Room expired. Create a new room.");

                rooms.delete(code);

                continue;
            }

            // Apply the existing reconnect grace to lobby seats too; a connected
            // host must not be stuck with an absent guest indefinitely.
            if (
                !r.match &&
                r.players.some(
                    (p) => p.disconnectedAt !== null && Date.now() - p.disconnectedAt > 20000
                )
            ) {
                r.players = r.players.filter(
                    (p) => p.disconnectedAt === null || Date.now() - p.disconnectedAt <= 20000
                );
                r.players.forEach((p, index) => {
                    if (p.socketId)
                        io.to(p.socketId).emit("joined", { code, token: p.token, index });
                });
                emitRoom(r);
            }

            if (r.match) {
                const gone = r.players.findIndex(
                    (p) => p.disconnectedAt !== null && Date.now() - p.disconnectedAt > 20000
                );

                if (gone >= 0 && r.match.phase !== "finished") {
                    finish(r.match, 1 - gone, "Opponent disconnected");

                    emitRoom(r);
                }

                if (r.players.every((p) => p.socketId)) step(r.match);

                if (frame % 3 === 0) io.to(code).emit("state", r.match);
            }
        }
    }, 1000 / 60);

    return {
        app,
        http,
        io,
        rooms,
        close: () => {
            clearInterval(timer);

            return new Promise<void>((resolve) => io.close(() => resolve()));
        }
    };
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    const arena = createArenaServer();

    const stopLocalModel = startLocalModel();

    const port = Number(process.env.PORT || 3001);

    arena.http.listen(port, "0.0.0.0", () =>
        console.log(`Motion Boxing Arena server: http://localhost:${port}`)
    );

    const shutdown = () => {
        stopLocalModel();

        void arena.close().then(() => process.exit(0));
    };

    process.on("SIGTERM", shutdown);

    process.on("SIGINT", shutdown);
}
