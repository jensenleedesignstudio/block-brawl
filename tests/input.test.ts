import { test } from "node:test";
import assert from "node:assert/strict";
import type { Socket } from "socket.io-client";
import { emitGameInput, isGameKey, isFreshPose } from "../src/game/input";

test("late worker results and pre-blur camera poses cannot become fresh gestures", () => {
    assert.equal(isFreshPose(100, 200, 0), true);
    assert.equal(isFreshPose(100, 750, 0), true);
    assert.equal(isFreshPose(100, 751, 0), false);
    assert.equal(isFreshPose(100, 200, 150), false);
    assert.equal(isFreshPose(180, 200, 150), true);
});

test("combat input never enters the offline reconnect buffer", () => {
    const events: unknown[] = [];
    const socket = { connected: false, emit: (...args: unknown[]) => events.push(args) };
    emitGameInput(socket as unknown as Socket, "action", { action: "jab", held: true });
    emitGameInput(socket as unknown as Socket, "movement", 1);
    assert.deepEqual(events, []);
    socket.connected = true;
    emitGameInput(socket as unknown as Socket, "action", { action: "block", held: false });
    emitGameInput(socket as unknown as Socket, "movement", 0);
    assert.deepEqual(events, [
        ["action", { action: "block", held: false }],
        ["movement", 0]
    ]);
});

test("browser shortcuts, text composition and focused UI cannot trigger combat", () => {
    const key = { target: { closest: () => null } } as unknown as KeyboardEvent;
    assert.equal(isGameKey(key), true);
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing"]) {
        assert.equal(isGameKey({ ...key, [modifier]: true } as KeyboardEvent), false);
    }
    assert.equal(
        isGameKey({ ...key, target: { closest: () => ({}) } } as unknown as KeyboardEvent),
        false
    );
});

test("closing a menu keeps letter controls available without turning button activation into a block", () => {
    const button = { closest: (selector: string) => (selector.includes("button") ? {} : null) };
    const key = (value: string) => ({ key: value, target: button }) as unknown as KeyboardEvent;
    assert.equal(isGameKey(key("j")), true);
    assert.equal(isGameKey(key("k")), true);
    assert.equal(isGameKey(key("Escape")), true);
    assert.equal(isGameKey(key(" ")), false);
    assert.equal(isGameKey(key("Enter")), false);
});
