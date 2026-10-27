import {SAVE_KEY} from './save';
import {STAGES, type StageId} from '../levels/courses';
import {isVariant, type VariantId} from '../levels/course-ids';
import {cleanName} from './profiles';
import type {ContestResult} from '../systems/share';
import {C} from '../config';
// Class contests live outside the player save: they never touch normal records or unlocks.
export const CONTESTS_KEY = SAVE_KEY + ':contests';
export const MAX_CONTESTS = 20;
export const MAX_ENTRIES = 80;
export interface Entry {
  name: string;
  score: number;
  complete: boolean;
  stars: number;
  maps: number;
  hpLoss: number;
  time: number;
}
export interface HostedContest {
  id: string;
  title: string;
  // Unknown when results arrive before the contest itself was opened on this device.
  stage: StageId | null;
  variant: VariantId | null;
  assist: boolean;
  entries: Entry[];
}
export interface ContestBook {
  hosted: HostedContest[];
  // Each sailor's best run per contest on this device, keyed "contest:profile".
  best: Record<string, Entry>;
}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
// Result codes carry no signature (there is no server to sign them), so a student who learns the
// format could type in any score. Contest courses are fixed-length normal courses run at a constant
// speed, so a real result's parts must add up: this flags codes that could not come from a run.
export function suspicion(e: Entry): string | null {
  const distance = e.score - e.stars * 10 - e.maps * 100 - (e.complete ? 500 : 0),
    full = Math.floor(C.length / 10);
  if (distance < 0 || distance > full) return '점수가 별빛·지도·완주 보너스와 맞지 않아요';
  if (e.complete && distance < full) return '완주 기록인데 거리 점수가 모자라요';
  // The runner covers C.speed px per second of game time; half a second allows for rounding.
  if (e.time + 0.5 < (distance * 10) / C.speed) return '달린 시간에 비해 거리가 너무 길어요';
  return null;
}
const better = (a: Entry, b: Entry) =>
  a.score - b.score || Number(a.complete) - Number(b.complete) || b.hpLoss - a.hpLoss || b.time - a.time;
export const rank = (entries: Entry[]) => [...entries].sort((a, b) => better(b, a) || a.name.localeCompare(b.name));
const entry = (e: Partial<Entry>): Entry | null => {
  const n = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
  const name = typeof e.name === 'string' ? cleanName(e.name) : '';
  if (!name || !n(e.score, 99999) || !n(e.stars, 100) || !n(e.maps, 3) || !n(e.hpLoss, 99) || !n(e.time, 3600))
    return null;
  return {
    name,
    score: e.score!,
    complete: e.complete === true,
    stars: e.stars!,
    maps: e.maps!,
    hpLoss: e.hpLoss!,
    time: e.time!,
  };
};
export function readContests(raw: string | null): ContestBook {
  const out: ContestBook = {hosted: [], best: {}};
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as ContestBook;
    for (const c of Array.isArray(v.hosted) ? v.hosted.slice(0, MAX_CONTESTS) : []) {
      if (!c || typeof c.id !== 'string' || !/^[a-z0-9]{6}$/.test(c.id) || out.hosted.some(h => h.id === c.id))
        continue;
      out.hosted.push({
        id: c.id,
        title: (typeof c.title === 'string' && cleanName(c.title)) || '우리 반 대회',
        stage: STAGES.includes(c.stage as StageId) ? c.stage : null,
        variant: isVariant(String(c.variant)) ? c.variant : null,
        assist: c.assist === true,
        entries: (Array.isArray(c.entries) ? c.entries : [])
          .map(entry)
          .filter((e): e is Entry => !!e)
          .slice(0, MAX_ENTRIES),
      });
    }
    for (const [key, e] of Object.entries(v.best && typeof v.best === 'object' ? v.best : {})) {
      const clean = entry(e);
      if (clean && /^[a-z0-9]{6}:[a-z0-9]{1,16}$/.test(key)) out.best[key] = clean;
    }
  } catch {}
  return out;
}
export class Contests {
  book: ContestBook;
  constructor(private storage: Store | null) {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(CONTESTS_KEY) ?? null;
    } catch {}
    this.book = readContests(raw);
  }
  save() {
    try {
      this.storage?.setItem(CONTESTS_KEY, JSON.stringify(this.book));
      return true;
    } catch {
      return false;
    }
  }
  find(id: string) {
    return this.book.hosted.find(c => c.id === id);
  }
  host(link: Omit<HostedContest, 'entries'>) {
    const known = this.find(link.id);
    if (known) {
      Object.assign(known, {title: link.title, stage: link.stage, variant: link.variant, assist: link.assist});
    } else {
      if (this.book.hosted.length >= MAX_CONTESTS) this.book.hosted.pop();
      this.book.hosted.unshift({...link, entries: []});
    }
    this.save();
    return this.find(link.id)!;
  }
  // Keeps each name's best run; a result for an unknown contest opens a board for it.
  add(result: ContestResult) {
    const c =
      this.find(result.contest) ??
      this.host({id: result.contest, title: `대회 ${result.contest}`, stage: null, variant: null, assist: false});
    const e = entry(result)!,
      i = c.entries.findIndex(x => x.name === e.name);
    if (i >= 0) {
      if (better(e, c.entries[i]) > 0) c.entries[i] = e;
    } else if (c.entries.length < MAX_ENTRIES) c.entries.push(e);
    else return {contest: c, added: false};
    this.save();
    return {contest: c, added: true};
  }
  remove(id: string) {
    this.book.hosted = this.book.hosted.filter(c => c.id !== id);
    this.save();
  }
  drop(id: string, name: string) {
    const c = this.find(id);
    if (c) c.entries = c.entries.filter(e => e.name !== name);
    this.save();
  }
  clear(id: string) {
    const c = this.find(id);
    if (c) c.entries = [];
    this.save();
  }
  record(contest: string, profile: string, e: Entry) {
    const key = `${contest}:${profile}`,
      old = this.book.best[key];
    if (!old || better(e, old) > 0) this.book.best[key] = e;
    this.save();
    return this.book.best[key];
  }
}
export const newContestId = () =>
  Array.from({length: 6}, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
