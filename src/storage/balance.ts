import {SAVE_KEY} from './save';
import type {DamageEvent, DamageKind} from '../systems/damage';
// Course balance for the teacher (settings → 📊 코스 균형 통계, off until turned on): on this
// device only, how often each course is run and finished, and where and on what heroes lose HP.
// Nothing here is in a sailor's record, a backup, a share code or a score.
export const BALANCE_KEY = SAVE_KEY + ':balance';
export const BALANCE_ON_KEY = SAVE_KEY + ':balance-on';
// A course is cut into ten stretches.
export const STRETCHES = 10;
const MAX = 1_000_000;
export interface CourseBalance {
  runs: number;
  done: number;
  // HP lost in each tenth of the course, and where unfinished runs ended.
  hits: number[];
  ends: number[];
  kinds: Partial<Record<DamageKind, number>>;
}
export type Balance = Record<string, CourseBalance>;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
const COURSE = /^[a-z]+\/[a-z0-9-]+$/;
const count = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? Math.min(v, MAX) : 0);
const row = (v: unknown) =>
  Array.from({length: STRETCHES}, (_, i) => count(Array.isArray(v) ? (v as unknown[])[i] : 0));
export function readBalance(raw: string | null): Balance {
  const out: Balance = {};
  try {
    const v = JSON.parse(raw ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
    for (const [key, c] of Object.entries(v as Record<string, Record<string, unknown>>).slice(0, 200)) {
      if (!COURSE.test(key) || !c || typeof c !== 'object') continue;
      const kinds: Partial<Record<DamageKind, number>> = {};
      if (c.kinds && typeof c.kinds === 'object')
        for (const [k, n] of Object.entries(c.kinds as Record<string, unknown>).slice(0, 40))
          if (/^[a-z]+$/.test(k) && count(n)) kinds[k as DamageKind] = count(n);
      out[key] = {
        runs: count(c.runs),
        done: Math.min(count(c.done), count(c.runs)),
        hits: row(c.hits),
        ends: row(c.ends),
        kinds,
      };
    }
  } catch {}
  return out;
}
export const balanceOn = (storage: Store) => {
  try {
    return storage?.getItem(BALANCE_ON_KEY) === '1';
  } catch {
    return false;
  }
};
export function setBalanceOn(storage: Store, on: boolean) {
  try {
    if (on) storage?.setItem(BALANCE_ON_KEY, '1');
    else storage?.removeItem(BALANCE_ON_KEY);
  } catch {}
}
export const stretchOf = (x: number, length: number) =>
  Math.max(0, Math.min(STRETCHES - 1, Math.floor((x / length) * STRETCHES)));
// One finished ordinary run, added to the course's counts.
export function addRun(
  b: Balance,
  course: string,
  run: {complete: boolean; distance: number; length: number; damage: readonly DamageEvent[]},
) {
  if (!COURSE.test(course)) return b;
  const c = b[course] ?? {runs: 0, done: 0, hits: row([]), ends: row([]), kinds: {}};
  c.runs = Math.min(MAX, c.runs + 1);
  if (run.complete) c.done = Math.min(c.runs, c.done + 1);
  else c.ends[stretchOf(run.distance, run.length)]++;
  for (const e of run.damage) {
    c.hits[stretchOf(e.x, run.length)]++;
    c.kinds[e.kind] = Math.min(MAX, (c.kinds[e.kind] ?? 0) + 1);
  }
  b[course] = c;
  return b;
}
export function recordBalance(storage: Store, course: string, run: Parameters<typeof addRun>[2]) {
  if (!balanceOn(storage)) return;
  try {
    const b = addRun(readBalance(storage?.getItem(BALANCE_KEY) ?? null), course, run);
    storage?.setItem(BALANCE_KEY, JSON.stringify(b));
  } catch {}
}
export function clearBalance(storage: Store) {
  try {
    storage?.removeItem(BALANCE_KEY);
  } catch {}
}
// The course's hardest stretch (most HP lost), or null with no losses.
export function hardest(c: CourseBalance) {
  const top = Math.max(...c.hits);
  return top ? c.hits.indexOf(top) : null;
}
export function topKind(c: CourseBalance): DamageKind | null {
  const e = Object.entries(c.kinds).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  return e ? (e[0] as DamageKind) : null;
}
// Two devices' counts added together (the teacher gathers each classroom device's file).
export function mergeBalance(a: Balance, b: Balance): Balance {
  const out: Balance = structuredClone(a);
  for (const [key, c] of Object.entries(b)) {
    const o = out[key];
    if (!o) {
      out[key] = structuredClone(c);
      continue;
    }
    o.runs = Math.min(MAX, o.runs + c.runs);
    o.done = Math.min(o.runs, o.done + c.done);
    o.hits = o.hits.map((n, i) => Math.min(MAX, n + c.hits[i]));
    o.ends = o.ends.map((n, i) => Math.min(MAX, n + c.ends[i]));
    for (const [k, n] of Object.entries(c.kinds))
      o.kinds[k as DamageKind] = Math.min(MAX, (o.kinds[k as DamageKind] ?? 0) + (n ?? 0));
  }
  return out;
}
export const BALANCE_FILE = 'odyssey-run-balance';
export const balanceFile = (b: Balance) => JSON.stringify({kind: BALANCE_FILE, version: 1, balance: b});
export function readBalanceFile(v: unknown): Balance {
  const o = v as Record<string, unknown> | null;
  if (!o || o.kind !== BALANCE_FILE) throw Error('코스 균형 통계 파일이 아니에요.');
  return readBalance(JSON.stringify(o.balance ?? {}));
}
export function saveBalance(storage: Store, b: Balance) {
  try {
    storage?.setItem(BALANCE_KEY, JSON.stringify(b));
  } catch {}
}
