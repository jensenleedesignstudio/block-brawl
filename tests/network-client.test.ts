import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSocketClient } from "../src/network";

test("multiplayer loads from frontend assets without a backend script or DOM", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "window");
    const browser = Object.create(globalThis);
    browser.location = { protocol: "file:" };
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

    try {
        await assert.rejects(loadSocketClient(), /require the server/);
        browser.location.protocol = "https:";
        const first = loadSocketClient();
        assert.equal(loadSocketClient(), first, "concurrent requests reuse the client load");
        const factory = await first;
        const socket = factory("https://multiplayer.example", { autoConnect: false });
        assert.equal(socket.connected, false);
        assert.equal(typeof socket.connect, "function");
        socket.disconnect();
    } finally {
        if (original) Object.defineProperty(globalThis, "window", original);
        else Reflect.deleteProperty(globalThis, "window");
    }
});
