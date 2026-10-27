import type {RunnerEvent} from '../player/runner';
// Short patterns only; browsers without vibration (iOS Safari) simply ignore them.
const PATTERNS: Partial<Record<RunnerEvent['kind'], number | number[]>> = {
  hurt: 60,
  fall: [40, 40, 80],
  block: 25,
  map: [20, 30, 20],
  finish: [30, 50, 30, 50, 60],
};
export function vibrate(kind: RunnerEvent['kind'], enabled: boolean) {
  const pattern = PATTERNS[kind];
  if (!enabled || pattern === undefined || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {}
}
