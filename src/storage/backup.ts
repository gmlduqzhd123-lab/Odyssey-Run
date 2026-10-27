import {validateSave, SaveStore, type Save} from './save';
import {mergeSaves} from './merge';
import {readBook, profileKey, PROFILES_KEY, MAX_PROFILES, cleanName, type ProfileBook} from './profiles';
import {readContests, CONTESTS_KEY, Contests, type ContestBook} from './contests';
// One file for a whole class: every sailor's save, the sailor list and contest boards.
// Restoring merges instead of replacing, so nothing already on the device is lost.
export const CLASS_BACKUP_LIMIT = 4 * 1024 * 1024;
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface ClassBackup {
  kind: 'odyssey-run-class';
  version: 1;
  exportedAt: string;
  profiles: ProfileBook;
  saves: Record<string, Save>;
  contests: ContestBook;
}
export function classBackup(storage: Store): ClassBackup {
  const profiles = readBook(storage.getItem(PROFILES_KEY)),
    saves: Record<string, Save> = {};
  for (const p of profiles.list) {
    try {
      const raw = storage.getItem(profileKey(p.id));
      if (raw) saves[p.id] = validateSave(JSON.parse(raw));
    } catch {
      // A damaged save stays on the device untouched; it is simply not exported.
    }
  }
  return {
    kind: 'odyssey-run-class',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    saves,
    contests: readContests(storage.getItem(CONTESTS_KEY)),
  };
}
export function readClassBackup(raw: unknown): ClassBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('반 전체 백업 파일이 아니에요.');
  const v = raw as Record<string, unknown>;
  if (v.kind !== 'odyssey-run-class' || v.version !== 1) throw Error('반 전체 백업 파일이 아니에요.');
  const profiles = readBook(JSON.stringify(v.profiles ?? null)),
    saves: Record<string, Save> = {};
  const rawSaves = v.saves && typeof v.saves === 'object' ? (v.saves as Record<string, unknown>) : {};
  for (const p of profiles.list) {
    if (rawSaves[p.id] === undefined) continue;
    try {
      saves[p.id] = validateSave(rawSaves[p.id]);
    } catch {
      throw Error(`‘${p.name}’ 항해사의 기록이 올바르지 않아요.`);
    }
  }
  return {
    kind: 'odyssey-run-class',
    version: 1,
    exportedAt: typeof v.exportedAt === 'string' ? v.exportedAt.slice(0, 40) : '',
    profiles,
    saves,
    contests: readContests(JSON.stringify(v.contests ?? {})),
  };
}
export interface RestoreSummary {
  merged: number;
  added: number;
  skipped: number;
  contests: number;
}
export function restoreClass(storage: Store, backup: ClassBackup): RestoreSummary {
  const book = readBook(storage.getItem(PROFILES_KEY)),
    summary: RestoreSummary = {merged: 0, added: 0, skipped: 0, contests: 0};
  for (const p of backup.profiles.list) {
    const name = cleanName(p.name),
      // Same id first, then same name; the first sailor always exists, so it always merges.
      target = book.list.find(q => q.id === p.id) ?? book.list.find(q => q.name === name);
    let id: string;
    if (target) {
      id = target.id;
      summary.merged++;
    } else if (book.list.length < MAX_PROFILES) {
      id = book.list.some(q => q.id === p.id) ? Math.random().toString(36).slice(2, 10).padEnd(6, '0') : p.id;
      book.list.push({id, name});
      summary.added++;
    } else {
      summary.skipped++;
      continue;
    }
    const save = backup.saves[p.id];
    if (!save) continue;
    const store = new SaveStore(storage, profileKey(id));
    store.data = store.blocked ? save : mergeSaves(store.data, save);
    // A damaged local copy is kept as this sailor's backup before the merged save replaces it.
    if (store.blocked) store.replace(save);
    else store.persist();
  }
  storage.setItem(PROFILES_KEY, JSON.stringify(book));
  const contests = new Contests(storage);
  for (const c of backup.contests.hosted) {
    const known = contests.find(c.id);
    if (!known || (!known.stage && c.stage))
      contests.host({id: c.id, title: c.title, stage: c.stage, variant: c.variant, assist: c.assist});
    for (const e of c.entries) contests.add({kind: 'result', contest: c.id, ...e});
    summary.contests++;
  }
  for (const [key, e] of Object.entries(backup.contests.best)) contests.record(key.split(':')[0], key.split(':')[1], e);
  return summary;
}
