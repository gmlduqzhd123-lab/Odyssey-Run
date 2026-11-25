// Watches real frame times while a run is playing. When the device cannot keep up (a long stretch
// averaging under ~40 fps), "auto" graphics quality steps down to the light renderer.
export const SLOW_FRAME = 1 / 40;
const WINDOW = 3;
export class FrameWatch {
  private times: number[] = [];
  private total = 0;
  private fired = false;
  // The whole run's frames, for stepping "auto" quality back up after a smooth voyage.
  private runTime = 0;
  private runFrames = 0;
  // Returns true once, the first time the last three seconds of play averaged slower than SLOW_FRAME.
  add(delta: number) {
    // Tab switches and pauses produce one huge frame; they say nothing about rendering speed.
    if (!(delta > 0) || delta > 0.25) return false;
    this.runTime += delta;
    this.runFrames++;
    if (this.fired) return false;
    this.times.push(delta);
    this.total += delta;
    while (this.total - this.times[0] >= WINDOW) this.total -= this.times.shift()!;
    if (this.total < WINDOW - 0.1) return false;
    if (this.total / this.times.length <= SLOW_FRAME) return false;
    this.fired = true;
    return true;
  }
  reset() {
    this.times = [];
    this.total = 0;
  }
  // After quality has stepped down: watch again from scratch, so a still-slow device can step once more.
  rearm() {
    this.reset();
    this.fired = false;
  }
  // A new run starts its own average.
  begin() {
    this.rearm();
    this.runTime = 0;
    this.runFrames = 0;
  }
  // Seconds of play this run and the average frames per second (0 before any frame).
  get played() {
    return this.runTime;
  }
  get fps() {
    return this.runFrames ? this.runFrames / this.runTime : 0;
  }
}
// "Auto" quality has three steps: 0 full, 1 lighter (at most 1.5 device pixels a point, 1440p),
// 2 light (the same as "가볍게"). A slow stretch steps down one; a smooth run steps back up one.
export const AUTO_STEPS = 2;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
// The step is kept on the device ('step:1'); older versions wrote '1' for the light renderer.
export function readAutoStep(storage: Store, key: string) {
  try {
    const v = storage?.getItem(key);
    if (!v) return 0;
    if (v === '1') return AUTO_STEPS;
    const n = Number(v.replace('step:', ''));
    return Number.isInteger(n) ? Math.max(0, Math.min(AUTO_STEPS, n)) : 0;
  } catch {
    return 0;
  }
}
export function writeAutoStep(storage: Store, key: string, n: number) {
  try {
    if (n <= 0) storage?.removeItem(key);
    else storage?.setItem(key, 'step:' + Math.min(AUTO_STEPS, n));
  } catch {}
}
// A smooth run: at least 20 seconds of play averaging 57 fps or better.
export const smoothRun = (played: number, fps: number) => played >= 20 && fps >= 57;
// Paces the simulation by real frame time. A frame far longer than the recent ones (the device
// froze for a moment: a garbage collection, a notification, a slow tab) is not caught up in one
// jump; that time is let go, and the run gets a moment of shelter so a hazard that arrived
// during the freeze cannot hurt. A device that is simply slow keeps its full catch-up.
export const HITCH = 0.05;
export const SHELTER = 0.3;
export class Pacer {
  private average = 1 / 60;
  // Seconds of simulation for this frame, and whether it was a freeze.
  step(delta: number) {
    if (!(delta > 0)) return {time: 0, hitch: false};
    const hitch = delta > HITCH && delta > this.average * 2.5,
      time = Math.min(delta, 0.1, hitch ? Math.max(HITCH, this.average * 2) : 0.1);
    // Freezes count too, so a device that is simply slow soon stops looking frozen.
    this.average += (Math.min(delta, 0.1) - this.average) * 0.1;
    return {time, hitch};
  }
  reset() {
    this.average = 1 / 60;
  }
}
