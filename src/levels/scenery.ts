import {C} from '../config';
import type {REGIONS} from '../assets/terrain';
import type {Course, StageId} from './courses';
// What the painted sheets put into a voyage: the landscape behind it, and decorations from the
// terrain sheet along the way. Decorations sit behind the course and are never touched.
export type ViewId = keyof typeof REGIONS & `view-${string}`;
export const ISLAND_VIEWS = ['view-beach', 'view-cave', 'view-wind', 'view-sea'] as const;
// The five panels no island owns: each special voyage gets one.
export const SPARE_VIEWS = ['view-ruins', 'view-storm', 'view-forest', 'view-palace', 'view-night'] as const;
const BOSS_VIEWS: Record<StageId, ViewId> = {
  beach: 'view-ruins',
  cave: 'view-forest',
  wind: 'view-storm',
  sea: 'view-palace',
};
export function sceneryView(course: Pick<Course, 'id' | 'mode'>, special: 'daily' | null = null, day = 0): ViewId {
  if (course.mode === 'endless') return 'view-night';
  if (course.mode === 'boss') return BOSS_VIEWS[course.id];
  if (special === 'daily') return SPARE_VIEWS[((day % 5) + 5) % 5];
  return `view-${course.id}`;
}
// The harbor of Ithaca rises behind the last stretch of every island voyage.
export const HARBOR_FADE = {from: 2600, to: 1400} as const;
export const harborMix = (course: Pick<Course, 'mode' | 'length'>, x: number) => {
  if (course.mode) return 0;
  const end = course.length ?? C.length;
  return Math.max(0, Math.min(1, (x - (end - HARBOR_FADE.from)) / (HARBOR_FADE.from - HARBOR_FADE.to)));
};
export type DecorFrame = 'banner' | 'torch' | 'ruins' | 'vase' | 'sign';
export interface Decor {
  id: string;
  frame: DecorFrame;
  x: number;
  // Display height in logical pixels; the base stands on the ground line.
  h: number;
}
const SETS: Record<StageId, DecorFrame[]> = {
  beach: ['banner', 'vase', 'sign', 'ruins'],
  cave: ['torch', 'vase', 'torch', 'ruins'],
  wind: ['ruins', 'banner', 'ruins', 'sign'],
  sea: ['ruins', 'vase', 'banner', 'sign'],
};
const HEIGHT: Record<DecorFrame, number> = {banner: 118, torch: 96, ruins: 84, vase: 54, sign: 52};
export function decorFor(course: Pick<Course, 'id' | 'gaps' | 'obstacles' | 'platforms' | 'length'>): Decor[] {
  const end = (course.length ?? C.length) - 600,
    set = SETS[course.id],
    out: Decor[] = [];
  // Keep decorations off gaps and well away from obstacles so nothing reads as a hazard.
  const clear = (x: number) =>
    !course.gaps.some(g => x > g.x - 160 && x < g.x + g.w + 120) &&
    !course.obstacles.some(o => x > o.x - 240 && x < o.x + o.w + 180) &&
    !course.platforms.some(p => p.crumble && x > p.x - 160 && x < p.x + p.w + 120);
  for (let x = 520, n = 0; x < end; x += 25) {
    if (!clear(x)) continue;
    const frame = set[n % set.length];
    out.push({id: `${course.id}-decor-${n}`, frame, x, h: HEIGHT[frame]});
    n++;
    x += 1300;
  }
  return out;
}
