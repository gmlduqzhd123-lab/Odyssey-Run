import {SAVE_KEY} from './save';
import {STAGES, type StageId} from '../levels/courses';
// The teacher's lock on a shared classroom device: a PIN guards the actions that delete or
// replace records, and a lesson can open only some islands. It is a guard against slips and
// curious taps, not a security boundary: the PIN lives on this device (salted and hashed).
export const LOCK_KEY = SAVE_KEY + ':teacher-lock';
// One correct PIN keeps guarded actions open this long.
export const UNLOCK_MS = 10 * 60 * 1000;
export const PIN_PATTERN = /^\d{4,8}$/;
export interface LockConfig {
  salt: string;
  hash: string;
  // Islands open during a lesson; null when every unlocked island is open.
  lesson: StageId[] | null;
}
// Actions that delete or replace records. A prefix ending in ':' or '-' matches its arguments.
const GUARDED = [
  'reset-confirm',
  'import-confirm',
  'class-import-confirm',
  'storage-tidy',
  'storage-clean',
  'lock-off',
  'lesson-',
];
const GUARDED_PREFIXES = ['contest-delete:', 'contest-clear:', 'contest-drop:', 'gallery-remove:', 'profile-delete'];
export const guarded = (action: string) =>
  GUARDED.some(a => (a.endsWith('-') ? action.startsWith(a) : action === a)) ||
  GUARDED_PREFIXES.some(p => action.startsWith(p));
export function readLock(raw: string | null): LockConfig | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.salt !== 'string' || !/^[0-9a-f]{32}$/.test(v.salt)) return null;
    if (typeof v.hash !== 'string' || !/^[0-9a-f]{64}$/.test(v.hash)) return null;
    const lesson = Array.isArray(v.lesson)
      ? [...new Set(v.lesson.filter((id): id is StageId => STAGES.includes(id as StageId)))]
      : null;
    return {salt: v.salt, hash: v.hash, lesson: lesson && lesson.length ? lesson : null};
  } catch {
    return null;
  }
}
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
export async function hashPin(pin: string, salt: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)));
}
export async function makeLock(pin: string): Promise<LockConfig> {
  if (!PIN_PATTERN.test(pin)) throw Error('비밀번호는 숫자 4~8자리로 정해 주세요.');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return {salt, hash: await hashPin(pin, salt), lesson: null};
}
export const checkPin = async (lock: LockConfig, pin: string) =>
  PIN_PATTERN.test(pin) && (await hashPin(pin, lock.salt)) === lock.hash;
// During a lesson only the chosen islands can be started from the island map.
export const lessonOpen = (lock: LockConfig | null, id: StageId) => !lock?.lesson || lock.lesson.includes(id);
