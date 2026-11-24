import type {RunnerEvent} from '../player/runner';
// How a run feels without changing its rules: a hit stops the picture for a blink, a near miss
// slows it for a moment, and starlight caught in a row climbs a scale. Only real time is held
// back; the run's own clock, score, ghost and contest records are untouched. Reduced motion
// keeps the picture moving at an even pace (the scale still climbs).
export const HIT_STOP = 0.06;
export const NEAR_SLOW = 0.2;
export const NEAR_PACE = 0.4;
// Stars caught within this much run time of each other are one chain.
export const CHAIN_GAP = 0.6;
export class RunFeel {
  private freeze = 0;
  private slow = 0;
  private chain = 0;
  private lastStar = -Infinity;
  reset() {
    this.freeze = 0;
    this.slow = 0;
    this.chain = 0;
    this.lastStar = -Infinity;
  }
  // The note step for this event's sound (stars only) and whether the screen should flash.
  event(kind: RunnerEvent['kind'], time: number, reduced: boolean) {
    if (kind === 'star') {
      this.chain = time - this.lastStar <= CHAIN_GAP ? this.chain + 1 : 0;
      this.lastStar = time;
      return this.chain;
    }
    if (kind === 'hurt' || kind === 'fall') {
      this.chain = 0;
      this.lastStar = -Infinity;
      if (!reduced) this.freeze = HIT_STOP;
    } else if (kind === 'near' && !reduced) this.slow = NEAR_SLOW;
    return 0;
  }
  // How much of this frame's real time the simulation gets (0 during a hit stop).
  pace(delta: number) {
    if (this.freeze > 0) {
      this.freeze -= delta;
      return 0;
    }
    if (this.slow > 0) {
      this.slow -= delta;
      return NEAR_PACE;
    }
    return 1;
  }
  get stopped() {
    return this.freeze > 0;
  }
}
