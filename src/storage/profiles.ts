import {SAVE_KEY, validateSave, type Save} from './save';
import {STAGES} from '../levels/courses';
// Several players can share one device. The first profile keeps the original save key,
// so saves written before profiles existed stay where they were.
export const MAIN_PROFILE = 'main';
export const PROFILES_KEY = SAVE_KEY + ':profiles';
export const MAX_PROFILES = 40;
export const MAX_NAME = 12;
export interface Profile {
  id: string;
  name: string;
}
export interface ProfileBook {
  active: string;
  list: Profile[];
}
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const defaultBook = (): ProfileBook => ({active: MAIN_PROFILE, list: [{id: MAIN_PROFILE, name: '첫 항해사'}]});
export const profileKey = (id: string) => (id === MAIN_PROFILE ? SAVE_KEY : `${SAVE_KEY}:p:${id}`);
export function cleanName(raw: string) {
  // Control characters and surrounding spaces are dropped; names are always HTML-escaped when shown.
  return Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, '').trim())
    .slice(0, MAX_NAME)
    .join('');
}
export function readBook(raw: string | null): ProfileBook {
  if (raw === null) return defaultBook();
  try {
    const v = JSON.parse(raw) as ProfileBook;
    if (!v || !Array.isArray(v.list) || !v.list.length || v.list.length > MAX_PROFILES) return defaultBook();
    const list: Profile[] = [];
    for (const p of v.list) {
      if (!p || typeof p.id !== 'string' || !/^(main|[a-z0-9]{6,16})$/.test(p.id) || typeof p.name !== 'string')
        continue;
      const name = cleanName(p.name);
      if (name && !list.some(q => q.id === p.id)) list.push({id: p.id, name});
    }
    if (!list.some(p => p.id === MAIN_PROFILE)) list.unshift(defaultBook().list[0]);
    return {active: list.some(p => p.id === v.active) ? v.active : MAIN_PROFILE, list};
  } catch {
    return defaultBook();
  }
}
export class Profiles {
  book: ProfileBook;
  constructor(private storage: Store | null) {
    let raw: string | null = null;
    try {
      raw = storage?.getItem(PROFILES_KEY) ?? null;
    } catch {}
    this.book = readBook(raw);
  }
  get active() {
    return this.book.list.find(p => p.id === this.book.active)!;
  }
  private save() {
    try {
      this.storage?.setItem(PROFILES_KEY, JSON.stringify(this.book));
      return true;
    } catch {
      return false;
    }
  }
  add(name: string, id = Math.random().toString(36).slice(2, 10).padEnd(6, '0')) {
    const clean = cleanName(name);
    if (!clean) throw Error('이름을 한 글자 이상 적어 주세요.');
    if (this.book.list.length >= MAX_PROFILES) throw Error(`항해사는 ${MAX_PROFILES}명까지 만들 수 있어요.`);
    if (this.book.list.some(p => p.name === clean)) throw Error('같은 이름의 항해사가 이미 있어요.');
    this.book.list.push({id, name: clean});
    this.book.active = id;
    this.save();
    return id;
  }
  rename(id: string, name: string) {
    const clean = cleanName(name),
      p = this.book.list.find(p => p.id === id);
    if (!p || !clean) throw Error('이름을 한 글자 이상 적어 주세요.');
    if (this.book.list.some(q => q.id !== id && q.name === clean)) throw Error('같은 이름의 항해사가 이미 있어요.');
    p.name = clean;
    this.save();
  }
  use(id: string) {
    if (!this.book.list.some(p => p.id === id)) return false;
    this.book.active = id;
    return this.save();
  }
  remove(id: string) {
    if (id === MAIN_PROFILE || id === this.book.active) throw Error('사용 중인 항해사와 첫 항해사는 지울 수 없어요.');
    this.book.list = this.book.list.filter(p => p.id !== id);
    try {
      this.storage?.removeItem(profileKey(id));
      this.storage?.removeItem(profileKey(id) + ':backup');
    } catch {}
    this.save();
  }
  // Read-only summaries for the on-device class board; unreadable saves rank last.
  board() {
    return this.book.list
      .map(p => {
        let save: Save | null = null;
        try {
          const raw = this.storage?.getItem(profileKey(p.id));
          if (raw) save = validateSave(JSON.parse(raw));
        } catch {}
        return {...p, ...summary(save)};
      })
      .sort((a, b) => b.total - a.total || b.islands - a.islands || b.maps - a.maps || a.name.localeCompare(b.name));
  }
}
export function summary(save: Save | null) {
  if (!save) return {total: 0, islands: 0, maps: 0, quiz: 0};
  return {
    total: STAGES.reduce((n, id) => n + save.stages[id].bestScore, 0),
    islands: STAGES.filter(id => save.stages[id].complete).length,
    maps: STAGES.reduce((n, id) => n + save.stages[id].maps.length, 0),
    quiz: save.quiz.length,
  };
}
