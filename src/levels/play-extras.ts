import {C} from '../config';
import {isCeiling, type Course, type Rect} from './courses';
import {QUIZ_ANSWERS, quizIds, quizText} from './quiz';
import {seeded} from './endless';
// Extras for an ordinary island run (never a boss, daily, endless, contest, duo or student
// course, so shared records stay comparable): a blessing chosen before the start, a hidden
// treasure chest on each course, an O/X myth gate, and the combo chain.

// One god's blessing for one run, chosen at the start (none is the default).
export const BLESSINGS = {
  none: {icon: '·', name: '축복 없이', description: '평소처럼 달려요.'},
  athena: {icon: '🛡', name: '아테나의 방패', description: '방패를 들고 출발해요. 한 번 막아 줘요.'},
  hermes: {icon: '🪽', name: '헤르메스의 신발', description: '2단 점프가 더 높이 올라가요.'},
  poseidon: {
    icon: '🔱',
    name: '포세이돈의 파도',
    description: '처음 빠진 한 번은 체력을 잃지 않고, 소용돌이 물살도 붙잡지 못해요.',
  },
} as const;
export type BlessingId = keyof typeof BLESSINGS;
export const BLESSING_IDS = Object.keys(BLESSINGS) as BlessingId[];
export const isBlessing = (v: unknown): v is BlessingId => typeof v === 'string' && Object.hasOwn(BLESSINGS, v);
// Hermes's air jump is this much stronger than a plain one.
export const HERMES_JUMP = 1.18;

// The combo: starlight, near misses, monsters outwitted or struck, constellations, stories and
// maps in a row without losing HP. It earns its own combo points (the island score, shared
// records and contests never change).
export const COMBO_POINTS = {
  star: 10,
  near: 30,
  trick: 50,
  strike: 50,
  constellation: 60,
  discovery: 40,
  map: 80,
  gate: 40,
  treasure: 100,
  stomp: 40,
  spring: 20,
  swing: 30,
} as const;
export type ComboKind = keyof typeof COMBO_POINTS;
export const comboMultiplier = (n: number) => (n >= 50 ? 3 : n >= 25 ? 2 : n >= 10 ? 1.5 : 1);
// The highest combo and combo points one island run can hold (validation bounds).
export const MAX_COMBO = 400;
export const MAX_COMBO_POINTS = 60_000;

// Is the run-up [from, to] safe ground: no gap, hazard, low ceiling, platform, wind, current or
// spell, and no monster within reach? Crates and pillars (safe to touch, but they make a hero
// jump) are kept off only the last stretch before the gate, where the answer is given.
function clear(course: Course, from: number, to: number, reach: number) {
  const hit = (x: number, w: number, a = from) => x < to && x + w > a;
  return (
    !course.gaps.some(g => hit(g.x, g.w)) &&
    !course.obstacles.some(o => (o.role === 'hazard' || isCeiling(o.kind) ? hit(o.x, o.w) : hit(o.x, o.w, to - 420))) &&
    !course.platforms.some(p => hit(p.x, p.w)) &&
    !course.winds.some(w => hit(w.x, w.w)) &&
    !(course.currents ?? []).some(z => hit(z.x, z.w)) &&
    !(course.spells ?? []).some(z => hit(z.x, z.w)) &&
    !course.enemies.some(e => hit(e.x - reach, reach * 2))
  );
}

// The O/X gate: a statement on plain ground. "O" floats high over the path (jump to take it),
// "X" sits on the path (keep running to take it). Placed on the first plain stretch past the
// first third of the course.
export interface Gate {
  x: number;
  quiz: string;
  // The option the statement names, and whether it is the right answer.
  option: 0 | 1 | 2;
  truth: boolean;
}
export const GATE_LEAD = 700;
export const GATE_O: Rect = {x: -22, y: 268, w: 44, h: 44};
export const GATE_X: Rect = {x: -22, y: 396, w: 44, h: 44};
export function gateFor(course: Course, seed: string): Gate | null {
  const length = course.length ?? C.length;
  // Far from every monster if the course allows; a busy course settles for a little less room.
  for (const reach of [700, 450, 300, 150])
    for (let x = Math.round(length / 3 / 100) * 100; x < length - 3000; x += 100)
      if (clear(course, x - GATE_LEAD, x + 160, reach)) {
        const random = seeded('gate:' + seed),
          id = quizIds[Math.floor(random() * quizIds.length)],
          answer = QUIZ_ANSWERS[id],
          truth = random() < 0.5,
          wrong = ([0, 1, 2] as const).filter(i => i !== answer),
          option = truth ? answer : wrong[Math.floor(random() * 2)];
        return {x, quiz: id, option, truth};
      }
  return null;
}
export const gateStatement = (g: Gate) => {
  const q = quizText().find(q => q.id === g.quiz)!;
  return {question: q.question, option: q.options[g.option], answer: q.options[q.answer]};
};

// The hidden chest: above the highest plain plank of the course (a jump on the plank reaches it).
export interface Treasure extends Rect {
  id: string;
}
export function treasureFor(course: Course): Treasure | null {
  const planks = course.platforms
    .filter(p => !p.crumble && !p.lift && !p.seesaw && !p.moving && p.w >= 80)
    .filter(p => !course.obstacles.some(o => isCeiling(o.kind) && o.x < p.x + p.w && o.x + o.w > p.x))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const p = planks[0];
  if (!p) return null;
  return {id: `${course.id}/${course.variant ?? 'classic'}`, x: p.x + p.w / 2 - 18, y: p.y - 118, w: 36, h: 30};
}
