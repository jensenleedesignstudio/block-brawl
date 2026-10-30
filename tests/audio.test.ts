import { test } from "node:test";
import assert from "node:assert/strict";
import { sound, unlockAudio } from "../src/game/audio";

test("unavailable audio cannot prevent game startup, and finished effects disconnect their nodes", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "AudioContext");
    try {
        Object.defineProperty(globalThis, "AudioContext", { configurable: true, value: undefined });
        assert.doesNotThrow(unlockAudio);
        Object.defineProperty(globalThis, "AudioContext", {
            configurable: true,
            value: class {
                constructor () {
                    throw new Error("Audio device unavailable");
                }
            }
        });
        assert.doesNotThrow(unlockAudio);

        let disconnected = 0;
        const parameter = { setValueAtTime () {}, exponentialRampToValueAtTime () {} };
        const oscillator = {
            frequency: parameter,
            type: "",
            onended: null as (() => void) | null,
            connect () {},
            disconnect () {
                disconnected++;
            },
            start () {},
            stop () {}
        };
        const gain = {
            gain: parameter,
            connect () {},
            disconnect () {
                disconnected++;
            }
        };
        Object.defineProperty(globalThis, "AudioContext", {
            configurable: true,
            value: class {
                state = "running";
                currentTime = 0;
                destination = {};
                async resume () {}
                createOscillator () {
                    return oscillator;
                }
                createGain () {
                    return gain;
                }
            }
        });
        unlockAudio();
        await Promise.resolve();
        sound("hit");
        assert.equal(typeof oscillator.onended, "function");
        oscillator.onended?.();
        assert.equal(disconnected, 2);
    } finally {
        if (original) Object.defineProperty(globalThis, "AudioContext", original);
        else Reflect.deleteProperty(globalThis, "AudioContext");
    }
});
