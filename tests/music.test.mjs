// ============================================================
// MUSIC REGRESSION TESTS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { test } from "node:test";
import assert from "node:assert/strict";
import { musicNotes, MUSIC_LOOP_STEPS, MUSIC_BPM } from "../.test-build/src/game/music-score.js";
import { AmbientMusic } from "../.test-build/src/game/music.js";
test("arcade score loops at a fast tempo with bounded notes and melodic breathing room", () => {
    let rests = 0;

    const voices = new Set();

    assert.equal(MUSIC_BPM, 144);

    for (let step = 0; step < MUSIC_LOOP_STEPS; step++) {
        const notes = musicNotes(step);

        assert.deepEqual(notes, musicNotes(step + MUSIC_LOOP_STEPS));

        if (!notes.some((note) => note.voice === "keys")) rests++;

        for (const note of notes) {
            voices.add(note.voice);

            assert.ok(note.midi >= 24 && note.midi <= 84);

            assert.ok(note.volume > 0 && note.volume <= 0.06);

            assert.ok(note.duration > 0 && note.duration < 5);
        }
    }

    assert.ok(rests >= MUSIC_LOOP_STEPS / 4);

    assert.deepEqual([...voices].sort(), ["bass", "hat", "keys", "kick", "pixel", "snare"]);
});
test("music uses one scheduler, stops voices on mute and skips overdue scheduling after backgrounding", (t) => {
    let callback,
        intervals = 0,
        clears = 0;

    const starts = [],
        stops = [];

    t.mock.method(globalThis, "setInterval", (fn) => {
        callback = fn;

        intervals++;

        return 1;
    });

    t.mock.method(globalThis, "clearInterval", () => {
        clears++;
    });

    const param = () => ({
        value: 0,
        cancelScheduledValues () {},
        setTargetAtTime () {},
        setValueAtTime () {},
        linearRampToValueAtTime () {},
        exponentialRampToValueAtTime () {}
    });

    const node = () => ({
        gain: param(),
        frequency: param(),
        delayTime: param(),
        connect () {},
        disconnect () {}
    });

    const ctx = {
        currentTime: 0,
        state: "running",
        destination: {},
        createGain: node,
        createDelay: node,
        createBiquadFilter: node,
        createOscillator: () => ({
            ...node(),
            start (time) {
                starts.push(time);
            },
            stop (time) {
                stops.push(time);
            }
        })
    };

    const music = new AmbientMusic(ctx);

    music.start();

    music.start();

    assert.equal(intervals, 1);

    assert.ok(starts.length > 0);

    const before = starts.length;

    ctx.currentTime = 60;

    callback();

    assert.ok(starts.length - before <= 12);

    assert.ok(starts.slice(before).every((time) => time >= 60));

    music.stop();

    assert.ok(clears > 0);

    assert.ok(stops.some((time) => time === 60.15));

    ctx.currentTime = 61;

    music.start();

    assert.equal(intervals, 2);

    music.dispose();
});
