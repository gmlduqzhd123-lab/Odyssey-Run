import {STAGES, type StageId} from '../levels/courses';
import {VARIANTS, courseKey} from '../levels/course-ids';
import {MAX_COMBO, MAX_COMBO_POINTS, type BlessingId} from '../levels/play-extras';
import {quizIds} from '../levels/quiz';
const READING_IDS = STAGES;
// What the playful extras leave behind in a sailor's record: the best combo and combo points on
// each island, the hidden chests found (one per course) and how many O/X gates were answered right.
export interface ComboRecord {
  best: number;
  points: number;
}
export interface PlayRecord {
  combos: Partial<Record<StageId, ComboRecord>>;
  // Course keys (island/course) whose chest was found, in course order.
  treasures: string[];
  gates: number;
  // The wrong-answer notebook: myth questions missed and not yet answered right since, and how
  // many have been cleared from it.
  missed: string[];
  mastered: number;
  // Island reading passages answered (see levels/readings), and the best word-card game (fewest turns).
  readings: string[];
  cards: number;
  // Past weeks' totals (newest last), for the teacher's growth report.
  weeks: WeekSnapshot[];
  // The prologue practice run was finished.
  prologue: boolean;
}
export interface WeekSnapshot {
  week: string;
  runs: number;
  stars: number;
  quiz: number;
}
export const MAX_WEEKS = 26;
const WEEK = /^\d{4}-W\d{2}$/;
export interface RunExtras {
  combo: number;
  comboPoints: number;
  blessing: BlessingId;
  treasure?: string;
  gate?: {quiz: string; right: boolean};
  // Dynamic extras of an ordinary run: missions met, fevers, the chase escaped, monsters stomped.
  missions?: number;
  fevers?: number;
  chase?: boolean;
  stomps?: number;
}
export const MAX_GATES = 100_000;
export const TREASURE_KEYS: readonly string[] = STAGES.flatMap(s => VARIANTS.map(v => courseKey(s, v)));
export const emptyPlay = (): PlayRecord => ({
  combos: {},
  treasures: [],
  gates: 0,
  missed: [],
  mastered: 0,
  readings: [],
  cards: 0,
  weeks: [],
  prologue: false,
});
// Keeps a finished week's counters (a week with nothing done is not kept).
export function keepWeek(play: PlayRecord, w: {week: string; counts: Partial<Record<string, number>>}) {
  if (!WEEK.test(w.week) || play.weeks.some(x => x.week === w.week)) return;
  const snap = {week: w.week, runs: w.counts.runs ?? 0, stars: w.counts.stars ?? 0, quiz: w.counts.quiz ?? 0};
  if (!snap.runs && !snap.stars && !snap.quiz) return;
  play.weeks = [...play.weeks, snap].sort((a, b) => a.week.localeCompare(b.week)).slice(-MAX_WEEKS);
}
const ids = (v: unknown, allowed: readonly string[], fail: () => never) => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some(k => !allowed.includes(k as string)) || new Set(v).size !== v.length) fail();
  return allowed.filter(k => (v as string[]).includes(k));
};
const whole = (v: unknown, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
export function readPlay(v: unknown): PlayRecord {
  if (v === undefined) return emptyPlay();
  const p = v as Record<string, unknown>;
  const fail = (): never => {
    throw Error('콤보·보물 기록을 확인해 주세요.');
  };
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail();
  const combos = p.combos as Record<string, unknown>;
  if (!combos || typeof combos !== 'object' || Array.isArray(combos)) fail();
  const out = emptyPlay();
  for (const [id, raw] of Object.entries(combos)) {
    const c = raw as Record<string, unknown>;
    if (!STAGES.includes(id as StageId) || !c || typeof c !== 'object') fail();
    if (!whole(c.best, MAX_COMBO) || !whole(c.points, MAX_COMBO_POINTS)) fail();
    out.combos[id as StageId] = {best: c.best as number, points: c.points as number};
  }
  if (
    !Array.isArray(p.treasures) ||
    p.treasures.some(k => !TREASURE_KEYS.includes(k as string)) ||
    new Set(p.treasures).size !== p.treasures.length
  )
    fail();
  out.treasures = TREASURE_KEYS.filter(k => (p.treasures as string[]).includes(k));
  if (!whole(p.gates, MAX_GATES)) fail();
  out.gates = p.gates as number;
  // Fields added later: absent in older saves.
  out.missed = ids(p.missed, quizIds, fail);
  out.readings = ids(p.readings, READING_IDS, fail);
  if (p.mastered !== undefined && !whole(p.mastered, MAX_GATES)) fail();
  out.mastered = (p.mastered as number | undefined) ?? 0;
  if (p.cards !== undefined && !whole(p.cards, 999)) fail();
  out.cards = (p.cards as number | undefined) ?? 0;
  if (p.weeks !== undefined) {
    if (!Array.isArray(p.weeks) || p.weeks.length > MAX_WEEKS) fail();
    for (const w of p.weeks as Record<string, unknown>[]) {
      if (!w || typeof w.week !== 'string' || !WEEK.test(w.week)) fail();
      if (!whole(w.runs, 100_000) || !whole(w.stars, 100_000) || !whole(w.quiz, 100_000)) fail();
      out.weeks.push({
        week: w.week as string,
        runs: w.runs as number,
        stars: w.stars as number,
        quiz: w.quiz as number,
      });
    }
    if (new Set(out.weeks.map(w => w.week)).size !== out.weeks.length) fail();
    out.weeks.sort((a, b) => a.week.localeCompare(b.week));
  }
  if (p.prologue !== undefined && typeof p.prologue !== 'boolean') fail();
  out.prologue = p.prologue === true;
  return out;
}
// A finished run's extras folded into the record.
export function playRun(play: PlayRecord, stage: StageId, x: RunExtras | undefined) {
  if (!x) return;
  const now = play.combos[stage] ?? {best: 0, points: 0};
  if (x.combo || x.comboPoints)
    play.combos[stage] = {best: Math.max(now.best, x.combo), points: Math.max(now.points, x.comboPoints)};
  if (x.treasure && TREASURE_KEYS.includes(x.treasure) && !play.treasures.includes(x.treasure))
    play.treasures = TREASURE_KEYS.filter(k => k === x.treasure || play.treasures.includes(k));
  if (x.gate?.right) play.gates = Math.min(MAX_GATES, play.gates + 1);
  if (x.gate) answered(play, x.gate.quiz, x.gate.right);
}
// A myth question answered (the quiz or an O/X gate): a miss goes in the notebook, a right
// answer takes it out again and counts as mastered.
export function answered(play: PlayRecord, id: string, right: boolean) {
  if (!quizIds.includes(id)) return;
  if (!right && !play.missed.includes(id)) play.missed = quizIds.filter(q => q === id || play.missed.includes(q));
  else if (right && play.missed.includes(id)) {
    play.missed = play.missed.filter(q => q !== id);
    play.mastered = Math.min(MAX_GATES, play.mastered + 1);
  }
}
export function mergePlay(a: PlayRecord, b: PlayRecord): PlayRecord {
  const out = emptyPlay();
  for (const id of STAGES) {
    const x = a.combos[id],
      y = b.combos[id];
    if (x || y)
      out.combos[id] = {best: Math.max(x?.best ?? 0, y?.best ?? 0), points: Math.max(x?.points ?? 0, y?.points ?? 0)};
  }
  out.treasures = TREASURE_KEYS.filter(k => a.treasures.includes(k) || b.treasures.includes(k));
  out.gates = Math.max(a.gates, b.gates);
  out.missed = quizIds.filter(k => a.missed.includes(k) || b.missed.includes(k));
  out.mastered = Math.max(a.mastered, b.mastered);
  out.readings = READING_IDS.filter(k => a.readings.includes(k) || b.readings.includes(k));
  out.cards = !a.cards ? b.cards : !b.cards ? a.cards : Math.min(a.cards, b.cards);
  const weeks = new Map<string, WeekSnapshot>();
  for (const w of [...a.weeks, ...b.weeks]) {
    const x = weeks.get(w.week);
    weeks.set(
      w.week,
      x
        ? {
            week: w.week,
            runs: Math.max(x.runs, w.runs),
            stars: Math.max(x.stars, w.stars),
            quiz: Math.max(x.quiz, w.quiz),
          }
        : {...w},
    );
  }
  out.weeks = [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-MAX_WEEKS);
  out.prologue = a.prologue || b.prologue;
  return out;
}
