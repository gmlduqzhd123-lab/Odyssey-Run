import {STAGES, type StageId} from '../levels/courses';
import {seeded} from '../levels/endless';
import type {RunResult, Save} from './save';
// The monthly season: four bigger goals for the whole calendar month, the same for every class
// (picked from the month), and a title for each month they were all met. Only this month's
// counters and the months won are stored; days sailed come from the voyage calendar.
export interface Season {
  // YYYY-MM of the Korean date; '' before the first voyage.
  month: string;
  counts: Partial<Record<SeasonId, number>>;
  // Islands completed this month (the 'islands' goal counts different islands).
  islands: StageId[];
  // Months whose four goals were all met, oldest first.
  won: string[];
}
export const SEASON_GOALS = {
  // Three different islands: reachable from the first weeks of the voyage (the first three open in turn).
  islands: {name: '세 섬 순례', description: '이번 달에 서로 다른 섬 3곳 완주하기', target: 3},
  runs: {name: '꾸준한 항해', description: '섬을 20번 완주하기', target: 20},
  days: {name: '항해 달력', description: '이번 달에 10일 항해하기', target: 10},
  quiz: {name: '신화 박사', description: '신화 퀴즈 20문제 맞히기', target: 20},
  clean: {name: '상처 없는 항해', description: '체력을 잃지 않고 5번 완주하기', target: 5},
  stars: {name: '별빛 바다', description: '별빛 1,500개 모으기', target: 1500},
} as const;
export type SeasonId = keyof typeof SEASON_GOALS;
export const SEASON_IDS = Object.keys(SEASON_GOALS) as SeasonId[];
// One title per calendar month (January first), given for meeting that month's goals.
export const SEASON_TITLES = [
  '새해의 항해사',
  '별빛 길잡이',
  '봄바람의 선장',
  '이야기 수집가',
  '푸른 바다의 영웅',
  '여름 항로의 개척자',
  '세이렌을 이긴 귀',
  '해협의 용사',
  '지혜의 항해사',
  '아테나의 제자',
  '이타카의 수호자',
  '귀환의 영웅',
] as const;
export const MAX_WON = 120;
export const monthKey = (date: string) => date.slice(0, 7);
export const titleFor = (month: string) => SEASON_TITLES[Number(month.slice(5, 7)) - 1];
export const emptySeason = (): Season => ({month: '', counts: {}, islands: [], won: []});
export function seasonGoals(month: string): SeasonId[] {
  const random = seeded('season:' + month),
    pool = [...SEASON_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4);
}
// Progress on one goal this month (days come from the calendar, islands from the list).
export function seasonCount(save: Save, id: SeasonId, month: string) {
  if (id === 'days') return save.days.filter(d => d.startsWith(month + '-')).length;
  if (save.season.month !== month) return 0;
  if (id === 'islands') return save.season.islands.length;
  return save.season.counts[id] ?? 0;
}
export const seasonMet = (save: Save, month: string) =>
  seasonGoals(month).every(id => seasonCount(save, id, month) >= SEASON_GOALS[id].target);
function thisMonth(save: Save, date: string) {
  const month = monthKey(date);
  if (save.season.month !== month) save.season = {month, counts: {}, islands: [], won: save.season.won};
  return save.season;
}
// Checked after every count, and after a new sailing day (which can complete the 'days' goal).
function claim(save: Save) {
  const s = save.season;
  if (s.month && !s.won.includes(s.month) && seasonMet(save, s.month)) s.won = [...s.won, s.month].slice(-MAX_WON);
}
function bump(save: Save, date: string, id: Exclude<SeasonId, 'islands' | 'days'>, n: number) {
  if (n <= 0) return;
  const s = thisMonth(save, date);
  s.counts[id] = Math.min(100_000, (s.counts[id] ?? 0) + n);
}
// Called with the record after a run is recorded (the day is already on the calendar).
export function seasonRun(save: Save, r: RunResult, date: string) {
  const s = thisMonth(save, date);
  if (r.complete) {
    bump(save, date, 'runs', 1);
    if (!s.islands.includes(r.stage)) s.islands = [...s.islands, r.stage];
    if (r.hpLoss === 0) bump(save, date, 'clean', 1);
  }
  bump(save, date, 'stars', r.stars);
  claim(save);
}
export function seasonQuiz(save: Save, right: boolean, date: string) {
  thisMonth(save, date);
  if (right) bump(save, date, 'quiz', 1);
  claim(save);
}
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const count = (v: unknown, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
export function readSeason(v: unknown): Season {
  if (v === undefined) return emptySeason();
  const s = v as Record<string, unknown>;
  if (
    !s ||
    typeof s !== 'object' ||
    Array.isArray(s) ||
    typeof s.month !== 'string' ||
    !(s.month === '' || MONTH.test(s.month)) ||
    !s.counts ||
    typeof s.counts !== 'object' ||
    Array.isArray(s.counts) ||
    Object.entries(s.counts).some(
      ([k, n]) => !SEASON_IDS.includes(k as SeasonId) || k === 'islands' || k === 'days' || !count(n, 100_000),
    ) ||
    !Array.isArray(s.islands) ||
    s.islands.some(id => !STAGES.includes(id as StageId)) ||
    new Set(s.islands).size !== s.islands.length ||
    !Array.isArray(s.won) ||
    s.won.length > MAX_WON ||
    s.won.some(m => typeof m !== 'string' || !MONTH.test(m)) ||
    new Set(s.won).size !== s.won.length
  )
    throw Error('월간 시즌 기록을 확인해 주세요.');
  return {
    month: s.month,
    counts: {...(s.counts as Season['counts'])},
    islands: [...(s.islands as StageId[])],
    won: [...(s.won as string[])].sort(),
  };
}
// Two copies of a sailor: the later month wins; the same month takes the larger counts.
export function mergeSeason(a: Season, b: Season): Season {
  const [early, late] = a.month <= b.month ? [a, b] : [b, a],
    out = structuredClone(late);
  if (early.month === late.month) {
    for (const id of SEASON_IDS) {
      const n = Math.max(early.counts[id] ?? 0, late.counts[id] ?? 0);
      if (n) out.counts[id] = n;
    }
    out.islands = [...new Set([...early.islands, ...late.islands])];
  }
  out.won = [...new Set([...a.won, ...b.won])].sort().slice(-MAX_WON);
  return out;
}
