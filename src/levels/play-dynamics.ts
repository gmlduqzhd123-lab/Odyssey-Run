import {C} from '../config';
import {isCeiling, type Course, type StageId} from './courses';
import type {EnemyKind} from './enemies';
import {GATE_LEAD, type Gate} from './play-extras';
// Movement and pacing for an ordinary island run (see levels/play-extras for the other extras):
// fever time, a spring pad and a swing rope on plain ground, two surprise missions and one chase.
// Stomping monsters is the one change that holds in every mode: it never changes a score.

// Monsters a hero can land on: the ground and low-air ones (not the giant, the ghost or Scylla).
export const STOMPABLE: readonly EnemyKind[] = ['crab', 'stone', 'harpy'];
export const STOMP_BOUNCE = -560;

// Fever: every combo step fills the gauge; full, it gives five seconds of shelter and pull.
export const FEVER_FULL = 100;
export const FEVER_STEP = 3;
export const FEVER_TIME = 5;

// The spring launches higher than any jump; the rope throws the hero up from a jump into it.
export const SPRING_LAUNCH = -1000;
export const ROPE_LAUNCH = -900;
// The rope's hanging end, relative to its x: reach it with a jump (a standing hero passes below).
export const ROPE_END = {y: 300, r: 46};
export const ROPE_TOP = 40;

// Plain ground from `from` to `to`: no gap, hazard, low ceiling, crate, platform, wind, current,
// spell or monster within reach.
function plain(course: Course, from: number, to: number, reach = 500) {
  const hit = (x: number, w: number) => x < to && x + w > from;
  return (
    !course.gaps.some(g => hit(g.x, g.w)) &&
    // Hazards and low ceilings anywhere; crates and pillars (safe to land on) only near the spot.
    !course.obstacles.some(o =>
      o.role === 'hazard' || isCeiling(o.kind) ? hit(o.x - 40, o.w + 80) : o.x < from + 450 && o.x + o.w > from,
    ) &&
    !course.platforms.some(p => hit(p.x, p.w)) &&
    !course.winds.some(w => hit(w.x, w.w)) &&
    !(course.currents ?? []).some(z => hit(z.x, z.w)) &&
    !(course.spells ?? []).some(z => hit(z.x, z.w)) &&
    !course.enemies.some(e => hit(e.x - reach, reach * 2))
  );
}
const lengthOf = (c: Course) => c.length ?? C.length;
// The first plain stretch for something at x that needs [x - before, x + after], from a share of
// the course on, away from the O/X gate and anything already placed.
function spot(course: Course, share: number, before: number, after: number, taken: number[]) {
  const length = lengthOf(course);
  // From the chosen share on first, then from the first fifth; fewer monsters nearby only if needed.
  for (const from of [share, 0.2])
    for (const reach of [500, 300, 150])
      for (let x = Math.round((length * from) / 100) * 100; x < length - 2500; x += 100)
        if (plain(course, x - before, x + after, reach) && taken.every(t => Math.abs(t - x) > 1200)) return x;
  return null;
}
export interface Dynamics {
  spring: number | null;
  rope: number | null;
}
// The spring: a launch of about 1.1 s lands about 350 px on, so the run-up and landing stay plain.
export function dynamicsFor(course: Course, gate: Gate | null): Dynamics {
  const taken = gate ? [gate.x - GATE_LEAD / 2] : [],
    spring = spot(course, 0.5, 250, 800, taken);
  if (spring !== null) taken.push(spring);
  const rope = spot(course, 0.62, 300, 700, taken);
  return {spring, rope};
}

// Surprise missions: at a quarter and at seven tenths of the course, one short task.
export type MissionKind = 'stars' | 'clean' | 'stomp';
export interface Mission {
  kind: MissionKind;
  at: number;
  goal: number;
  seconds: number;
}
export const MISSION_TEXT: Record<MissionKind, string> = {
  stars: '돌발 미션! {s}초 안에 별빛 {n}개',
  clean: '돌발 미션! {s}초 동안 상처 없이',
  stomp: '돌발 미션! {s}초 안에 몬스터 밟기',
};
export const MISSION_REWARD = 200;
export function missionsFor(course: Course, stageIndex: number): Mission[] {
  const length = lengthOf(course),
    kinds: MissionKind[] = ['stars', 'clean', 'stomp'];
  return [0.25, 0.7].map((share, i) => {
    const at = Math.round(length * share);
    let kind = kinds[(stageIndex + i) % kinds.length];
    // Stomping needs a monster to land on within reach of the mission's time.
    if (
      kind === 'stomp' &&
      !course.enemies.some(e => STOMPABLE.includes(e.kind) && e.x > at && e.x < at + 10 * C.speed)
    )
      kind = 'stars';
    const stars = course.items.filter(t => t.kind === 'star' && t.x > at && t.x < at + 8 * C.speed).length;
    if (kind === 'stars' && stars < 6) kind = 'clean';
    return kind === 'stars'
      ? {kind, at, goal: Math.max(5, Math.floor(stars * 0.7)), seconds: 8}
      : kind === 'clean'
        ? {kind, at, goal: 1, seconds: 8}
        : {kind, at, goal: 1, seconds: 10};
  });
}

// The chase: something comes up behind the hero for a stretch of the course; it closes in with
// each hit, and getting through untouched earns combo points. It never hurts on its own.
export const CHASERS: Record<StageId, {name: string; texture: string}> = {
  beach: {name: '밀려오는 큰 파도', texture: 'wave'},
  cave: {name: '쫓아오는 키클롭스', texture: 'giant'},
  wind: {name: '휘몰아치는 돌풍', texture: 'gust'},
  circe: {name: '키르케의 마법 안개', texture: 'mist'},
  sea: {name: '세이렌의 노랫소리', texture: 'song'},
  strait: {name: '카리브디스의 소용돌이', texture: 'whirl'},
  palace: {name: '구혼자들의 추격', texture: 'suitors'},
};
export const CHASE_BONUS = 300;
export const chaseFor = (course: Course) => {
  const length = lengthOf(course);
  return {start: Math.round(length * 0.45), end: Math.round(length * 0.58)};
};
// A low ceiling is a reason not to jump into the rope (checked in tests with the placements).
export const ceilingOver = (course: Course, x: number) =>
  course.obstacles.some(o => isCeiling(o.kind) && o.x < x + 60 && o.x + o.w > x - 60);
