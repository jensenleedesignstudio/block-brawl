// ============================================================
// NETWORK REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createArenaServer } from "../server/index.js";
import { MAX_HP, MAX_STAMINA, STAMINA_COST, type Match } from "../shared/combat.js";

// ------------------------------------------------------------
// NEXT
// ------------------------------------------------------------

function next<T> (
    socket: Socket,
    event: string,
    predicate: (value: T) => boolean = () => true
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off(event, listener);

            reject(new Error(`Timed out waiting for ${event}`));
        }, 8000);

        const listener = (value: T) => {
            if (predicate(value)) {
                clearTimeout(timeout);

                socket.off(event, listener);

                resolve(value);
            }
        };

        socket.on(event, listener);
    });
}

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

interface Joined {
    code: string;
    token: string;
    index: number;
}
interface Room {
    players: { ready: boolean; connected: boolean }[];
    paused: boolean;
    match: Match | null;
}

test("party codes reject missing parties, normalize input, and free departed lobby seats", async () => {
    const arena = createArenaServer();
    const clients: Socket[] = [];
    await new Promise<void>((resolve) => arena.http.listen(0, "127.0.0.1", resolve));
    const address = arena.http.address();
    assert.ok(address && typeof address !== "string");
    const connect = async () => {
        const client = io(`http://127.0.0.1:${address.port}`, {
            transports: ["websocket"],
            reconnection: false,
            forceNew: true
        });
        clients.push(client);
        await next(client, "connect");
        return client;
    };
    try {
        const host = await connect(),
            guest = await connect(),
            replacement = await connect();
        const missing = next<string>(guest, "roomError");
        guest.emit("joinRoom", { code: "INVALID" });
        assert.match(await missing, /not found/i);

        const created = next<Joined>(host, "joined");
        host.emit("createRoom", { name: "HOST" });
        const party = await created;
        const joined = next<Joined>(guest, "joined");
        guest.emit("joinRoom", { code: ` ${party.code.toLowerCase()} `, name: "FRIEND" });
        assert.equal((await joined).index, 1);

        const waiting = next<Room>(host, "room", (r) => r.players.length === 2);
        host.emit("ready");
        assert.equal((await waiting).match, null, "one ready player cannot start the match");

        const promoted = next<Joined>(guest, "joined");
        host.emit("leaveRoom");
        assert.equal((await promoted).index, 0, "remaining fighter becomes the host");
        const replaced = next<Joined>(replacement, "joined");
        replacement.emit("joinRoom", { code: party.code });
        assert.equal((await replaced).index, 1, "a new friend can take the vacant seat");
        const disconnected = next<Room>(guest, "room", (r) => r.players.some((p) => !p.connected));
        replacement.disconnect();
        await disconnected;
        const vacancy = next<Room>(guest, "room", (r) => r.players.length === 1);
        arena.rooms.get(party.code)!.players[1].disconnectedAt = Date.now() - 21000;
        await vacancy;
        const lastLeft = next<Joined>(guest, "joined");
        guest.emit("createRoom");
        await lastLeft;
        assert.equal(arena.rooms.has(party.code), false, "empty parties are removed immediately");
    } finally {
        clients.forEach((client) => client.disconnect());
        await arena.close();
    }
});

test("authoritative two-player lobby, combat, disconnect pause, resume, rematch and leave", async () => {
    const arena = createArenaServer();

    await new Promise<void>((resolve) => arena.http.listen(0, "127.0.0.1", resolve));

    const address = arena.http.address();

    assert.ok(address && typeof address !== "string");

    const url = `http://127.0.0.1:${address.port}`,
        clients: Socket[] = [];

    const connect = async () => {
        const s = io(url, { transports: ["websocket"], reconnection: false, forceNew: true });

        clients.push(s);

        await next(s, "connect");

        return s;
    };

    try {
        const a = await connect(),
            b = await connect();

        const joinedA = next<Joined>(a, "joined");

        a.emit("createRoom", { name: "ALPHA" });

        const host = await joinedA;

        assert.match(host.code, /^[0-9A-F]{6}$/);

        assert.equal(host.index, 0);

        const joinedB = next<Joined>(b, "joined");

        b.emit("joinRoom", { code: host.code, name: "BRAVO" });

        const guest = await joinedB;

        assert.equal(guest.index, 1);

        const outsider = await connect(),
            denied = next<string>(outsider, "roomError");

        outsider.emit("joinRoom", { code: host.code });

        assert.match(await denied, /two fighters/);

        const roomReady = next<Room>(a, "room", (r) => !!r.match);

        a.emit("ready");

        b.emit("ready");

        const opening = (await roomReady).match!;
        assert.equal(opening.phase, "countdown");
        assert.equal(opening.remaining, 120 * 60);
        assert.deepEqual(
            opening.fighters.map((fighter) => fighter.hp),
            [135, 135]
        );

        const live = next<Match>(
            a,
            "state",
            (m) => m.phase === "fight" && m.fighters[1].x - m.fighters[0].x < 145
        );

        await live;

        const damage = next<Match>(b, "state", (m) => m.fighters[1].hp < MAX_HP);

        a.emit("action", { action: "jab", damage: 100000, stamina: 100000 });

        for (let i = 0; i < 10; i++) a.emit("action", { action: "hook", damage: 100000 });

        const hit = await damage;

        assert.equal(hit.fighters[1].hp, MAX_HP - 6);

        assert.equal(hit.fighters[0].stamina, MAX_STAMINA - STAMINA_COST.jab);

        const moved = next<Match>(a, "state", (m) => m.fighters[0].x < hit.fighters[0].x - 5);

        a.emit("movement", -1);

        assert.ok((await moved).fighters[0].x < hit.fighters[0].x - 5);

        a.emit("movement", 0);

        outsider.emit("action", { action: "cross" });

        const unchanged = await next<Match>(a, "state");

        assert.equal(unchanged.fighters[0].hp, MAX_HP);

        const paused = next<Room>(a, "room", (r) => r.paused);

        b.disconnect();

        assert.equal((await paused).paused, true);

        const before = await next<Match>(a, "state"),
            after = await next<Match>(a, "state");

        assert.equal(before.tick, after.tick);

        const replacement = await connect();

        const restored = next<Joined>(replacement, "joined");

        replacement.emit("joinRoom", { code: guest.code, token: guest.token });

        assert.equal((await restored).index, 1);

        const resumed = await next<Match>(a, "state", (m) => m.tick > after.tick);

        assert.ok(resumed.tick > after.tick);

        // Put the authoritative state one hit from a knockout; clients still submit only an action.
        const room = arena.rooms.get(host.code)!;

        room.match!.fighters[1].hp = 1;

        room.match!.fighters[0].action = "idle";

        room.match!.fighters[0].cooldown = 0;

        room.match!.hitstop = 0;

        const down = next<Match>(replacement, "state", (m) => m.phase === "knockdown");

        a.emit("action", { action: "cross" });

        assert.equal((await down).down, 1);

        for (let i = 0; i < 20; i++) {
            const progress = next<Match>(replacement, "state", (m) => m.recovery >= i + 1);

            replacement.emit("action", { action: i < 10 ? (i % 2 ? "cross" : "jab") : "recover" });

            await progress;
        }

        assert.equal(room.match!.fighters[1].hp, 60);

        await next<Match>(a, "state", (m) => m.phase === "fight");

        room.match!.fighters[1].hp = 1;

        room.match!.fighters[0].action = "idle";

        room.match!.fighters[0].cooldown = 0;

        room.match!.hitstop = 0;

        const downAgain = next<Match>(a, "state", (m) => m.phase === "knockdown");

        a.emit("action", { action: "cross" });

        assert.equal((await downAgain).recoveryGoal, 60);

        room.match!.recoveryTicks = 2;

        const knockout = await next<Match>(a, "state", (m) => m.phase === "finished");

        assert.equal(knockout.winner, 0);

        const rematch = next<Room>(a, "room", (r) => r.match?.phase === "countdown");

        a.emit("ready");

        replacement.emit("ready");

        assert.equal((await rematch).match?.fighters[0].hp, MAX_HP);

        const departure = next<Room>(a, "room", (r) => r.match?.phase === "finished");

        replacement.emit("leaveRoom");

        assert.equal((await departure).match?.reason, "Opponent left");
    } finally {
        clients.forEach((s) => s.disconnect());

        await arena.close();
    }
});

test("online motion mode bypasses stamina independently and persists through rematch", async () => {
    const arena = createArenaServer();

    await new Promise<void>((resolve) => arena.http.listen(0, "127.0.0.1", resolve));

    const address = arena.http.address();

    assert.ok(address && typeof address !== "string");

    const clients: Socket[] = [];

    try {
        const connect = async () => {
            const s = io(`http://127.0.0.1:${address.port}`, {
                transports: ["websocket"],
                reconnection: false,
                forceNew: true
            });

            clients.push(s);

            await next(s, "connect");

            return s;
        };

        const a = await connect(),
            b = await connect();

        const joined = next<Joined>(a, "joined");

        a.emit("createRoom");

        const host = await joined;

        const guest = next<Joined>(b, "joined");

        b.emit("joinRoom", { code: host.code });

        await guest;

        const ready = next<Room>(a, "room", (r) => !!r.match);

        a.emit("ready", { inputMode: "motion" });

        b.emit("ready");

        await ready;

        const m = arena.rooms.get(host.code)!.match!;

        assert.equal(m.fighters[0].inputMode, "motion");

        assert.equal(m.fighters[1].inputMode, "keyboard");

        m.phase = "fight";

        m.fighters.forEach((f) => (f.stamina = 0));

        const punch = next<Match>(a, "state", (s) => s.fighters[0].action === "jab");

        a.emit("action", { action: "jab" });

        b.emit("action", { action: "jab" });

        const result = await punch;

        assert.equal(result.fighters[0].stamina, 0);

        assert.notEqual(result.fighters[1].action, "jab");

        const switched = next<Room>(
            a,
            "room",
            (r) => r.match?.fighters[0].inputMode === "keyboard"
        );

        a.emit("inputMode", "keyboard");

        await switched;

        assert.equal(m.fighters[0].stamina, 0);

        const motion = next<Room>(a, "room", (r) => r.match?.fighters[0].inputMode === "motion");

        a.emit("inputMode", "motion");

        await motion;

        m.phase = "finished";

        const rematch = next<Room>(a, "room", (r) => r.match?.phase === "countdown");

        a.emit("ready");

        b.emit("ready");

        assert.equal((await rematch).match?.fighters[0].inputMode, "motion");
    } finally {
        clients.forEach((s) => s.disconnect());

        await arena.close();
    }
});
