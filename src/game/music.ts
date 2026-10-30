// ============================================================
// MUSIC VOICES AND PLAYBACK SCHEDULING
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------

import { musicNotes, MUSIC_STEP_SECONDS, type MusicNote } from "./music-score.js";

// ------------------------------------------------------------
// AMBIENT MUSIC
// ------------------------------------------------------------

/** Short lookahead schedules against the audio clock, independently of rendering. */
export class AmbientMusic {
    private timer: ReturnType<typeof setInterval> | undefined;
    private next = 0;
    private step = 0;
    private voices = new Set<OscillatorNode>();
    private output: GainNode;
    private echo: DelayNode;
    private feedback: GainNode;
    private wet: GainNode;
    constructor (private context: AudioContext) {
        this.output = context.createGain();

        this.output.gain.value = 0.55;

        this.output.connect(context.destination);

        this.echo = context.createDelay(2);

        this.echo.delayTime.value = MUSIC_STEP_SECONDS * 1.5;

        this.feedback = context.createGain();

        this.feedback.gain.value = 0.12;

        this.wet = context.createGain();

        this.wet.gain.value = 0.08;

        this.echo.connect(this.feedback);

        this.feedback.connect(this.echo);

        this.echo.connect(this.wet);

        this.wet.connect(this.output);
    }
    start () {
        if (this.timer !== undefined) return;

        this.output.gain.cancelScheduledValues(this.context.currentTime);

        this.output.gain.setTargetAtTime(0.55, this.context.currentTime, 0.15);

        this.next = this.context.currentTime + 0.06;

        const schedule = () => {
            if (this.context.state !== "running") return;

            // Do not dump overdue notes after browser throttling or device suspension.
            if (this.next < this.context.currentTime) this.next = this.context.currentTime + 0.04;

            while (this.next < this.context.currentTime + 0.12) {
                for (const note of musicNotes(this.step)) this.play(note, this.next);

                this.step++;

                this.next += MUSIC_STEP_SECONDS;
            }
        };

        schedule();

        this.timer = setInterval(schedule, 50);
    }
    stop () {
        clearInterval(this.timer);

        this.timer = undefined;

        const now = this.context.currentTime;

        this.output.gain.cancelScheduledValues(now);

        this.output.gain.setTargetAtTime(0, now, 0.03);

        for (const oscillator of this.voices) oscillator.stop(now + 0.15);

        this.voices.clear();
    }
    dispose () {
        this.stop();

        this.output.disconnect();

        this.echo.disconnect();

        this.feedback.disconnect();

        this.wet.disconnect();
    }
    private play (note: MusicNote, time: number) {
        const oscillator = this.context.createOscillator(),
            gain = this.context.createGain(),
            filter = this.context.createBiquadFilter();

        oscillator.type =
            note.voice === "kick" ? "sine" : note.voice === "bass" ? "triangle" : "square";

        oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);

        const percussion = note.voice === "hat" || note.voice === "snare";

        filter.type = percussion ? "highpass" : "lowpass";

        filter.frequency.value = percussion
            ? 1800
            : note.voice === "bass" || note.voice === "kick"
              ? 900
              : 4800;

        if (note.voice === "kick") {
            oscillator.frequency.setValueAtTime(130, time);

            oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        } else if (percussion) {
            oscillator.frequency.setValueAtTime(note.voice === "hat" ? 6500 : 1600, time);

            oscillator.frequency.exponentialRampToValueAtTime(
                note.voice === "hat" ? 3800 : 280,
                time + note.duration
            );
        }

        const attack = 0.003;

        gain.gain.setValueAtTime(0, time);

        gain.gain.linearRampToValueAtTime(note.volume, time + attack);

        gain.gain.exponentialRampToValueAtTime(0.0001, time + note.duration);

        oscillator.connect(filter);

        filter.connect(gain);

        gain.connect(this.output);

        if (!percussion && note.voice !== "kick" && note.voice !== "bass") gain.connect(this.echo);

        this.voices.add(oscillator);

        oscillator.onended = () => {
            this.voices.delete(oscillator);

            oscillator.disconnect();

            filter.disconnect();

            gain.disconnect();
        };

        oscillator.start(time);

        oscillator.stop(time + note.duration + 0.05);
    }
}
