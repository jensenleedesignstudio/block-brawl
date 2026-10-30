// ============================================================
// SOUND EFFECTS AND MUSIC CONTROLS
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { AmbientMusic } from "./music.js";

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

let context: AudioContext | undefined;
let music: AmbientMusic | undefined;
let musicEnabled = false;

// ------------------------------------------------------------
// SET MUSIC ENABLED
// ------------------------------------------------------------

export function setMusicEnabled (enabled: boolean) {
    musicEnabled = enabled;

    if (!enabled) {
        music?.stop();

        return;
    }

    if (context?.state === "running") {
        music ??= new AmbientMusic(context);

        music.start();
    }
}

// ------------------------------------------------------------
// DISPOSE MUSIC
// ------------------------------------------------------------

export function disposeMusic () {
    musicEnabled = false;

    music?.dispose();

    music = undefined;
}

// ------------------------------------------------------------
// UNLOCK AUDIO
// ------------------------------------------------------------

export function unlockAudio () {
    // Audio availability must never prevent a match from starting.
    if (typeof AudioContext === "undefined") return;
    try {
        context ??= new AudioContext();
    } catch {
        return;
    }

    void context
        .resume()
        .then(() => {
            if (musicEnabled) setMusicEnabled(true);
        })
        .catch(() => {});
}

// ------------------------------------------------------------
// SOUND
// ------------------------------------------------------------

export function sound (kind: "hit" | "block" | "parry" | "bell") {
    if (!context || context.state !== "running") return;

    const o = context.createOscillator(),
        g = context.createGain();

    o.connect(g);

    g.connect(context.destination);

    o.type = kind === "bell" ? "sine" : kind === "parry" ? "square" : "triangle";

    const now = context.currentTime;

    o.frequency.setValueAtTime(
        kind === "bell" ? 740 : kind === "parry" ? 520 : kind === "hit" ? 135 : 240,
        now
    );

    o.frequency.exponentialRampToValueAtTime(
        kind === "bell" ? 650 : kind === "parry" ? 180 : 45,
        now + 0.15
    );

    g.gain.setValueAtTime(0.14, now);

    g.gain.exponentialRampToValueAtTime(0.001, now + (kind === "bell" ? 0.65 : 0.18));

    o.start();

    o.stop(now + 0.7);

    o.onended = () => {
        o.disconnect();
        g.disconnect();
    };
}
