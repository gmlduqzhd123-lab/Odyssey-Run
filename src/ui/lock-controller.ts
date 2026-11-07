import {STAGES, type StageId} from '../levels/courses';
import {
  LOCK_KEY,
  UNLOCK_MS,
  checkPin,
  guarded,
  lessonOpen,
  makeLock,
  readLock,
  type LockConfig,
} from '../storage/teacher-lock';
import {button} from './html';
// The teacher's lock on screen: the PIN dialog in front of a guarded action, setting and clearing
// the PIN, the lesson's islands, and closing the minutes a correct PIN opened.
export interface LockHost {
  ui: HTMLElement;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  // Runs an action again once the PIN was right (it is open then, so it is not asked again).
  run(action: string): void;
  // Shows the settings page again after a change.
  refresh(): void;
  say(selector: string, text: string): void;
}
export class TeacherLock {
  config: LockConfig | null = null;
  private unlockedUntil = 0;
  private fails = 0;
  private waitUntil = 0;
  private pending = '';
  constructor(private host: LockHost) {
    try {
      this.config = readLock(host.storage?.getItem(LOCK_KEY) ?? null);
    } catch {}
  }
  get open() {
    return Date.now() < this.unlockedUntil;
  }
  // Whether an island can be started from the island map during the lesson.
  lessonOpen(id: StageId) {
    return lessonOpen(this.config, id);
  }
  // True when the action must wait for the PIN (the dialog is then showing).
  stops(action: string) {
    if (!this.config || !guarded(action) || this.open) return false;
    this.ask(action);
    return true;
  }
  // The dialog sits over the current screen, so the screen the action expects is still there.
  private ask(action: string) {
    const ui = this.host.ui;
    this.pending = action;
    ui.querySelector('.pin-veil')?.remove();
    const veil = document.createElement('div');
    veil.className = 'veil pin-veil';
    veil.innerHTML = `<section class="panel" role="dialog" aria-modal="true" aria-labelledby="pin-title"><span class="eyebrow">FOR TEACHERS</span><h2 id="pin-title">선생님 비밀번호</h2><p>기록을 지우거나 바꾸는 일이라 선생님 확인이 필요해요.</p><label>비밀번호 <input id="teacher-pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></label><p role="status" id="pin-message"></p><div class="button-row">${button('pin-check', '확인', 'primary')}${button('pin-cancel', '취소', 'secondary')}</div></section>`;
    ui.append(veil);
    const input = veil.querySelector<HTMLInputElement>('#teacher-pin')!;
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') void this.check();
    });
    input.focus();
  }
  cancel() {
    this.host.ui.querySelector('.pin-veil')?.remove();
  }
  async check() {
    const input = this.host.ui.querySelector<HTMLInputElement>('#teacher-pin');
    if (!input || !this.config) return;
    if (Date.now() < this.waitUntil) return this.host.say('#pin-message', '잠시 뒤에 다시 입력해 주세요.');
    if (await checkPin(this.config, input.value)) {
      this.fails = 0;
      this.unlockedUntil = Date.now() + UNLOCK_MS;
      this.cancel();
      const action = this.pending;
      this.pending = '';
      if (action) this.host.run(action);
      return;
    }
    input.value = '';
    // Five wrong tries in a row wait 30 seconds before the next one.
    if (++this.fails >= 5) {
      this.fails = 0;
      this.waitUntil = Date.now() + 30_000;
      return this.host.say('#pin-message', '비밀번호가 5번 틀렸어요. 30초 뒤에 다시 입력해 주세요.');
    }
    this.host.say('#pin-message', '비밀번호가 맞지 않아요.');
  }
  async set() {
    const ui = this.host.ui,
      a = ui.querySelector<HTMLInputElement>('#lock-pin')?.value ?? '',
      b = ui.querySelector<HTMLInputElement>('#lock-pin2')?.value ?? '';
    if (a !== b) return this.host.say('#lock-message', '두 비밀번호가 달라요. 다시 입력해 주세요.');
    try {
      const lock = await makeLock(a);
      this.unlockedUntil = Date.now() + UNLOCK_MS;
      this.save(lock, '잠금을 켰어요. 기록을 지우거나 바꿀 때 비밀번호를 물어요.');
    } catch (error) {
      this.host.say('#lock-message', (error as Error).message);
    }
  }
  off() {
    this.save(null, '잠금을 껐어요.');
  }
  // Closes the ten minutes a correct PIN opened, before the device goes back to a student.
  now() {
    this.unlockedUntil = 0;
    this.host.refresh();
    this.host.say('#lock-message', '다시 잠갔어요. 기록을 지우거나 바꿀 때 비밀번호를 다시 물어요.');
  }
  saveLesson() {
    if (!this.config) return;
    const picked = STAGES.filter(id => this.host.ui.querySelector<HTMLInputElement>(`[data-lesson="${id}"]`)?.checked);
    if (!picked.length) return this.host.say('#lock-message', '열 섬을 하나 이상 골라 주세요.');
    const all = picked.length === STAGES.length;
    this.save(
      {...this.config, lesson: all ? null : picked},
      all ? '모든 섬을 열었어요.' : `수업 중에는 ${picked.length}개 섬만 열려요.`,
    );
  }
  clearLesson() {
    if (this.config) this.save({...this.config, lesson: null}, '모든 섬을 열었어요.');
  }
  private save(lock: LockConfig | null, message: string) {
    try {
      if (lock) this.host.storage?.setItem(LOCK_KEY, JSON.stringify(lock));
      else this.host.storage?.removeItem(LOCK_KEY);
    } catch {
      return this.host.say('#lock-message', '저장 공간이 부족해서 잠금을 저장하지 못했어요.');
    }
    this.config = lock;
    if (!lock) this.unlockedUntil = 0;
    this.host.refresh();
    this.host.say('#lock-message', message);
    this.host.ui.querySelector('.teacher-lock')?.scrollIntoView({block: 'nearest'});
  }
}
