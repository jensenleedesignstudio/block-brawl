// ============================================================
// ARCADE MUSIC NOTES AND RHYTHM
// ============================================================

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

/** Original 32-bar arcade score: quick pulse leads, arpeggios and synthesized drums. */
export const MUSIC_BPM = 144;
export const MUSIC_STEP_SECONDS = 60 / MUSIC_BPM / 2;
export const MUSIC_LOOP_STEPS = 32 * 8;

// ------------------------------------------------------------
// TYPES AND SHARED DATA STRUCTURES
// ------------------------------------------------------------

export interface MusicNote {
    midi: number;
    duration: number;
    volume: number;
    voice: "keys" | "bass" | "pixel" | "kick" | "snare" | "hat";
}

// ------------------------------------------------------------
// CONSTANTS AND INITIAL VALUES
// ------------------------------------------------------------

const chords = [
    [48, 55, 62, 64],
    [45, 52, 59, 60],
    [53, 60, 64, 67],
    [43, 50, 57, 62],
    [48, 55, 59, 62],
    [52, 59, 62, 67],
    [41, 48, 55, 60],
    [43, 50, 57, 59]
];
const melodies = [
    [76, 76, null, 79, 74, null, 76, 79, 72, null, 71, 74, null, 72, 67, null],
    [72, null, 76, 79, 76, 74, null, 71, 74, null, 71, 67, 71, 74, null, 76],
    [72, 76, null, 79, 81, null, 79, 76, 81, 79, null, 76, 79, 76, 72, null],
    [74, null, 71, 74, 69, 71, null, 74, 67, null, 69, 71, 74, 71, 67, null]
];

// ------------------------------------------------------------
// MUSIC NOTES
// ------------------------------------------------------------

export function musicNotes (step: number): MusicNote[] {
    const index = ((step % MUSIC_LOOP_STEPS) + MUSIC_LOOP_STEPS) % MUSIC_LOOP_STEPS;

    const chord = chords[Math.floor(index / 32)],
        notes: MusicNote[] = [],
        beat = index % 8;

    // Alternating root/octave bass and crisp eighth-note chord runs keep the groove moving.
    if (index % 2 === 0)
        notes.push({
            midi: chord[0] - 12 + (beat === 4 ? 12 : 0),
            duration: 0.17,
            volume: 0.045,
            voice: "bass"
        });

    notes.push({
        midi: chord[1 + (index % 3)] + 12,
        duration: 0.085,
        volume: 0.013,
        voice: "pixel"
    });

    const note = melodies[Math.floor(index / 64)][index % 16];

    if (note !== null)
        notes.push({
            midi: note,
            duration: index % 4 === 3 ? 0.24 : 0.14,
            volume: 0.033,
            voice: "keys"
        });

    if (beat === 0 || beat === 4 || index % 32 === 31)
        notes.push({ midi: 43, duration: 0.13, volume: 0.06, voice: "kick" });

    if (beat === 2 || beat === 6)
        notes.push({ midi: 74, duration: 0.075, volume: 0.018, voice: "snare" });

    notes.push({ midi: 84, duration: 0.025, volume: beat % 2 ? 0.009 : 0.006, voice: "hat" });

    return notes;
}
