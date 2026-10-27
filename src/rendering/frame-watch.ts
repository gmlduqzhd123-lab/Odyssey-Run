// Watches real frame times while a run is playing. When the device cannot keep up (a long stretch
// averaging under ~40 fps), "auto" graphics quality steps down to the light renderer.
export const SLOW_FRAME = 1 / 40;
const WINDOW = 3;
export class FrameWatch {
  private times: number[] = [];
  private total = 0;
  private fired = false;
  // Returns true once, the first time the last three seconds of play averaged slower than SLOW_FRAME.
  add(delta: number) {
    // Tab switches and pauses produce one huge frame; they say nothing about rendering speed.
    if (this.fired || !(delta > 0) || delta > 0.25) return false;
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
}
