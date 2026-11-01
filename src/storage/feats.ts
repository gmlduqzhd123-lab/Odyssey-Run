import {STAGES} from '../levels/courses';
import {constellationIds, stampIds, storyIds} from '../levels/adventure';
import {QUIZ, quizIds} from '../levels/quiz';
import {seeded} from '../levels/endless';
import {HEROES, heroUnlocked} from '../systems/heroes';
import type {RunResult, Save} from './save';
// Achievements, weekly challenges and the voyage calendar. Badges are read from the record
// itself; only the days sailed, this week's counters and quiz answers are stored.
export interface Weekly {
  // ISO week of the Korean date, e.g. 2026-W44.
  week: string;
  counts: Partial<Record<WeeklyId, number>>;
  // Whether this week's three challenges were all met, and how many weeks that has happened.
  claimed: boolean;
  done: number;
}
export const WEEKLY_TASKS = {
  runs: {name: '완주 항해', description: '섬을 5번 완주하기', target: 5},
  stars: {name: '별빛 수집', description: '별빛 300개 모으기', target: 300},
  maps: {name: '지도 탐험', description: '지도 조각 5개 줍기', target: 5},
  clean: {name: '상처 없는 항해', description: '체력을 잃지 않고 2번 완주하기', target: 2},
  dodge: {name: '지혜로운 회피', description: '몬스터 15마리 피하기', target: 15},
  quiz: {name: '신화 공부', description: '신화 퀴즈 3문제 맞히기', target: 3},
  special: {name: '특별 항해', description: '보스·오늘의 항해·끝없는 항해 2번', target: 2},
  weather: {name: '궂은 날씨', description: '비·폭풍·안개 속에서 1번 완주하기', target: 1},
} as const;
export type WeeklyId = keyof typeof WEEKLY_TASKS;
export const WEEKLY_IDS = Object.keys(WEEKLY_TASKS) as WeeklyId[];
export const MAX_DAYS = 400;
export const emptyWeekly = (): Weekly => ({week: '', counts: {}, claimed: false, done: 0});
// ISO 8601 week of a YYYY-MM-DD date (the week starts on Monday).
export function weekKey(date: string) {
  const d = new Date(date + 'T00:00:00Z'),
    day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  // d is now the Thursday of that week, which decides the week's year.
  const year = d.getUTCFullYear(),
    week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
// Everyone in a class gets the same three challenges in the same week.
export function weeklyTasks(week: string): WeeklyId[] {
  const random = seeded('weekly:' + week),
    pool = [...WEEKLY_IDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
function thisWeek(save: Save, date: string) {
  const week = weekKey(date);
  if (save.weekly.week !== week) save.weekly = {week, counts: {}, claimed: false, done: save.weekly.done};
  return save.weekly;
}
function bump(save: Save, date: string, id: WeeklyId, n: number) {
  if (n <= 0) return;
  const w = thisWeek(save, date);
  w.counts[id] = Math.min(100_000, (w.counts[id] ?? 0) + n);
  if (!w.claimed && weeklyTasks(w.week).every(t => (w.counts[t] ?? 0) >= WEEKLY_TASKS[t].target)) {
    w.claimed = true;
    w.done++;
  }
}
export function markDay(save: Save, date: string) {
  if (!save.days.includes(date)) save.days = [...save.days, date].sort().slice(-MAX_DAYS);
}
// A finished run (normal or special) counts toward the calendar and this week's challenges.
export function recordRun(save: Save, r: RunResult, date: string, how: {special: boolean; weather: boolean}): Save {
  const out = structuredClone(save);
  markDay(out, date);
  thisWeek(out, date);
  if (r.complete) bump(out, date, 'runs', 1);
  bump(out, date, 'stars', r.stars);
  bump(out, date, 'maps', r.maps.length);
  if (r.complete && r.hpLoss === 0) bump(out, date, 'clean', 1);
  bump(out, date, 'dodge', r.adventure?.evaded ?? 0);
  if (how.special) bump(out, date, 'special', 1);
  if (how.weather && r.complete) bump(out, date, 'weather', 1);
  return out;
}
export function recordQuiz(save: Save, id: string, choice: number, date: string): Save {
  const q = QUIZ.find(q => q.id === id);
  if (!q || ![0, 1, 2].includes(choice)) return save;
  const out = structuredClone(save),
    picks = out.quizPicks[id] ?? [0, 0, 0];
  picks[choice] = Math.min(100_000, picks[choice] + 1);
  out.quizPicks[id] = picks;
  markDay(out, date);
  if (choice === q.answer) bump(out, date, 'quiz', 1);
  return out;
}
// Longest run of consecutive days, and the run ending today (or yesterday, not yet broken).
export function streaks(days: readonly string[], today: string) {
  const n = (d: string) => Math.round(Date.parse(d + 'T00:00:00Z') / 86_400_000),
    set = new Set(days.map(n));
  let best = 0;
  for (const d of set) {
    if (set.has(d - 1)) continue;
    let k = 0;
    while (set.has(d + k)) k++;
    best = Math.max(best, k);
  }
  let current = 0,
    d = set.has(n(today)) ? n(today) : n(today) - 1;
  while (set.has(d)) {
    current++;
    d--;
  }
  return {best, current};
}
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  done: (s: Save) => boolean;
}
const maps = (s: Save) => STAGES.reduce((n, id) => n + s.stages[id].maps.length, 0);
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first',
    name: '첫 귀환',
    description: '섬 하나를 완주해요',
    icon: '⚑',
    done: s => STAGES.some(id => s.stages[id].complete),
  },
  {
    id: 'islands',
    name: '다섯 섬의 영웅',
    description: '다섯 섬을 모두 완주해요',
    icon: '⚓',
    done: s => STAGES.every(id => s.stages[id].complete),
  },
  {
    id: 'maps',
    name: '귀환의 지도',
    description: '지도 조각을 모두 모아요',
    icon: '🗺',
    done: s => maps(s) === STAGES.length * 3,
  },
  {
    id: 'stars',
    name: '별빛 사냥꾼',
    description: '한 섬에서 별빛 90개를 모아요',
    icon: '✦',
    done: s => STAGES.some(id => s.stages[id].bestStars >= 90),
  },
  {
    id: 'three-stars',
    name: '세 개의 별',
    description: '★★★ 섬을 3개 만들어요',
    icon: '★',
    done: s => STAGES.filter(id => s.stages[id].bestRating === 3).length >= 3,
  },
  {
    id: 'sky',
    name: '밤하늘의 항해사',
    description: '별자리를 모두 완성해요',
    icon: '✧',
    done: s => s.journal.constellations.length === constellationIds.length,
  },
  {
    id: 'stories',
    name: '이야기 수집가',
    description: '숨은 이야기를 모두 찾아요',
    icon: '✎',
    done: s => s.journal.stories.length === storyIds.length,
  },
  {
    id: 'stamps',
    name: '도장 열 개',
    description: '도전 도장 10개를 받아요',
    icon: '◎',
    done: s => s.journal.stamps.length >= 10,
  },
  {
    id: 'stamps-all',
    name: '도장 수첩 완성',
    description: '도전 도장을 모두 받아요',
    icon: '◉',
    done: s => s.journal.stamps.length === stampIds.length,
  },
  {
    id: 'boss',
    name: '패턴을 읽는 눈',
    description: '보스 도전 하나를 돌파해요',
    icon: '⚔',
    done: s => Object.values(s.expeditions.bosses).some(b => b?.complete),
  },
  {
    id: 'bosses',
    name: '모든 보스 돌파',
    description: '다섯 보스를 모두 돌파해요',
    icon: '🛡',
    done: s => STAGES.every(id => s.expeditions.bosses[id]?.complete),
  },
  {
    id: 'endless',
    name: '먼 바다로',
    description: '끝없는 항해에서 1,000m를 가요',
    icon: '∞',
    done: s => Object.values(s.endless).some(e => (e?.bestDistance ?? 0) >= 10_000),
  },
  {
    id: 'quiz',
    name: '신화 박사',
    description: '신화 퀴즈를 모두 맞혀요',
    icon: '?',
    done: s => s.quiz.length === quizIds.length,
  },
  {
    id: 'heroes',
    name: '모두의 오디세이',
    description: '네 영웅을 모두 만나요',
    icon: '👥',
    done: s => HEROES.every(h => heroUnlocked(s, h.id)),
  },
  {
    id: 'streak',
    name: '일주일 연속 항해',
    description: '7일 연속으로 항해해요',
    icon: '📅',
    done: s => streaks(s.days, s.days.at(-1) ?? '2000-01-01').best >= 7,
  },
  {id: 'days', name: '서른 번의 항해일', description: '30일 동안 항해해요', icon: '🗓', done: s => s.days.length >= 30},
  {
    id: 'weekly',
    name: '주간 도전 완수',
    description: '한 주의 도전 세 개를 모두 해내요',
    icon: '🏅',
    done: s => s.weekly.done >= 1,
  },
];
// Validation for the stored parts (save.ts calls these; older saves have none of them).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const count = (v: unknown, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
export function readDays(v: unknown): string[] {
  if (v === undefined) return [];
  if (
    !Array.isArray(v) ||
    v.length > MAX_DAYS ||
    new Set(v).size !== v.length ||
    v.some(d => typeof d !== 'string' || !DATE.test(d) || !Number.isFinite(Date.parse(d + 'T00:00:00Z')))
  )
    throw Error('항해 달력 기록을 확인해 주세요.');
  return [...v].sort();
}
export function readWeekly(v: unknown): Weekly {
  if (v === undefined) return emptyWeekly();
  const w = v as Record<string, unknown>;
  if (
    !w ||
    typeof w !== 'object' ||
    Array.isArray(w) ||
    typeof w.week !== 'string' ||
    !(w.week === '' || /^\d{4}-W\d{2}$/.test(w.week)) ||
    typeof w.claimed !== 'boolean' ||
    !count(w.done, 10_000) ||
    !w.counts ||
    typeof w.counts !== 'object' ||
    Array.isArray(w.counts) ||
    Object.entries(w.counts).some(([k, n]) => !WEEKLY_IDS.includes(k as WeeklyId) || !count(n, 100_000))
  )
    throw Error('주간 도전 기록을 확인해 주세요.');
  return {week: w.week, counts: {...(w.counts as Weekly['counts'])}, claimed: w.claimed, done: w.done as number};
}
export function readQuizPicks(v: unknown): Save['quizPicks'] {
  if (v === undefined) return {};
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.entries(v).some(
      ([id, p]) => !quizIds.includes(id) || !Array.isArray(p) || p.length !== 3 || p.some(n => !count(n, 100_000)),
    )
  )
    throw Error('신화 퀴즈 답 기록을 확인해 주세요.');
  return structuredClone(v as Save['quizPicks']);
}
export function mergeFeats(a: Save, b: Save, out: Save) {
  out.days = [...new Set([...a.days, ...b.days])].sort().slice(-MAX_DAYS);
  const [early, late] = a.weekly.week <= b.weekly.week ? [a.weekly, b.weekly] : [b.weekly, a.weekly];
  out.weekly = structuredClone(late);
  if (early.week === late.week) {
    for (const id of WEEKLY_IDS) {
      const n = Math.max(early.counts[id] ?? 0, late.counts[id] ?? 0);
      if (n) out.weekly.counts[id] = n;
    }
    out.weekly.claimed = early.claimed || late.claimed;
  }
  out.weekly.done = Math.max(a.weekly.done, b.weekly.done);
  out.quizPicks = {};
  for (const id of new Set([...Object.keys(a.quizPicks), ...Object.keys(b.quizPicks)])) {
    const x = a.quizPicks[id] ?? [0, 0, 0],
      y = b.quizPicks[id] ?? [0, 0, 0];
    out.quizPicks[id] = [0, 1, 2].map(i => Math.max(x[i], y[i])) as [number, number, number];
  }
}
