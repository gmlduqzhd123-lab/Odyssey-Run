import {SAVE_KEY} from './save';
// Browsers may clear site storage: Safari after seven days without a visit (unless the game is
// installed to the home screen), others when the disk runs low. Records live only here, so the
// game asks for persistent storage and reminds the teacher to keep a whole-class backup.
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export const BACKUP_AT_KEY = SAVE_KEY + ':class-backup-at';
const REMINDED_KEY = SAVE_KEY + ':backup-reminded';
const DAY = 86_400_000;
export const REMIND_AFTER_DAYS = 14;
const read = (storage: Store | null, key: string) => {
  try {
    const t = Number(storage?.getItem(key));
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch {
    return null;
  }
};
const write = (storage: Store | null, key: string, now: number) => {
  try {
    storage?.setItem(key, String(now));
  } catch {}
};
export const markBackup = (storage: Store | null, now = Date.now()) => write(storage, BACKUP_AT_KEY, now);
// Whole days since the last whole-class backup, or null when there has never been one.
export function backupAge(storage: Store | null, now = Date.now()) {
  const at = read(storage, BACKUP_AT_KEY);
  return at === null ? null : Math.max(0, Math.floor((now - at) / DAY));
}
// Only devices that hold a class (several sailors or a contest board) are reminded, at most weekly.
export function backupReminder(storage: Store | null, classroom: boolean, now = Date.now()) {
  if (!classroom) return null;
  const age = backupAge(storage, now),
    reminded = read(storage, REMINDED_KEY);
  if (age !== null && age < REMIND_AFTER_DAYS) return null;
  if (reminded !== null && now - reminded < 7 * DAY) return null;
  write(storage, REMINDED_KEY, now);
  return age === null
    ? '이 기기에 반 기록이 있어요. 설정 → 반 전체 내보내기로 백업 파일을 만들어 두세요.'
    : `반 전체 백업을 한 지 ${age}일이 지났어요. 설정 → 반 전체 내보내기로 기록을 지켜 주세요.`;
}
export type Protection = 'persisted' | 'best-effort' | 'unsupported';
export async function protection(): Promise<Protection> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
// Some browsers grant this silently and others decide from site engagement; it is asked after
// progress worth keeping exists, never on first load.
export async function requestProtection(): Promise<Protection> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    return (await navigator.storage.persist()) ? 'persisted' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
// iPhone and iPad Safari (iPadOS reports itself as a Mac with touch) outside the home-screen app.
export function iosBrowserTab() {
  if (typeof navigator === 'undefined') return false;
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as Navigator & {standalone?: boolean}).standalone === true ||
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches);
  return ios && !standalone;
}
