import type {StageId} from '../levels/courses';
// Layers over an island's theme that follow the run: level 1 (a combo of 10, a chase) adds a
// drum pulse, level 2 (fever, a boss) adds a bright arpeggio. Synthesized on the theme's own beat
// (tempos and keys from scripts/compose-music.py), so no extra audio files are downloaded.
export const THEME_BEAT: Record<StageId, {bpm: number; root: number}> = {
  beach: {bpm: 112, root: 293.66},
  cave: {bpm: 76, root: 164.81},
  wind: {bpm: 132, root: 196},
  circe: {bpm: 84, root: 220},
  sea: {bpm: 96, root: 293.66},
  strait: {bpm: 132, root: 293.66},
  palace: {bpm: 100, root: 261.63},
};
// A major pentatonic over two octaves: it sits on every theme without clashing.
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
export const arpNote = (root: number, step: number) => root * 2 * 2 ** (PENTA[step % PENTA.length] / 12);
// Beats of the theme that fall in [from, to), counted from the song's start.
export function beatsIn(songStart: number, bpm: number, from: number, to: number) {
  const beat = 60 / bpm,
    first = Math.ceil((from - songStart) / beat - 1e-9),
    out: {k: number; t: number}[] = [];
  for (let k = Math.max(0, first); songStart + k * beat < to; k++) out.push({k, t: songStart + k * beat});
  return out;
}
export class MusicLayers {
  private until = 0;
  level = 0;
  reset() {
    this.until = 0;
  }
  // Schedules the next fraction of a second of layered notes.
  schedule(c: AudioContext, out: AudioNode, songStart: number, stage: StageId, volume: number) {
    const now = c.currentTime,
      from = Math.max(now, this.until),
      to = now + 0.15;
    this.until = to;
    if (this.level <= 0 || volume <= 0) return;
    const {bpm, root} = THEME_BEAT[stage];
    for (const {k, t} of beatsIn(songStart, bpm / 2, from, to)) {
      // Half beats: a low thump on the beat, a soft tick between.
      if (k % 2 === 0) this.tone(c, out, 70, t, 0.18, 0.22 * volume, 'sine', 0.45);
      else this.tone(c, out, 2400, t, 0.04, 0.03 * volume, 'square', 1);
      if (this.level >= 2) this.tone(c, out, arpNote(root, k % 8), t, 0.16, 0.05 * volume, 'triangle', 1);
    }
  }
  private tone(
    c: AudioContext,
    out: AudioNode,
    hz: number,
    t: number,
    d: number,
    v: number,
    type: OscillatorType,
    drop: number,
  ) {
    try {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(hz, t);
      if (drop !== 1) o.frequency.exponentialRampToValueAtTime(hz * drop, t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(out);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      o.start(t);
      o.stop(t + d + 0.02);
    } catch {}
  }
}
// Short phrases for the big moments of a run.
export const STINGERS: Record<string, number[]> = {
  map: [0, 4, 7, 12],
  fever: [0, 4, 7, 12, 16, 19],
  mission: [0, 7, 12],
  chase: [0, 5, 9, 12],
  strike: [12, 7],
  revive: [0, 4, 7],
  overtake: [7, 12],
};
