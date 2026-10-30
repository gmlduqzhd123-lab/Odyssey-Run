export interface Actions {
  jump(): void;
  slide(held: boolean): void;
  pause(): void;
  active(): boolean;
  pauseActive?(): boolean;
  // Toggle mode: one press ducks until the next slide press or a jump.
  slideToggle?(): boolean;
}
// Accessibility switches usually send Space or Enter; Enter jumps like Space.
const JUMP_KEYS = ['Enter', 'NumpadEnter'];
export interface PadLike {
  buttons: readonly {pressed: boolean}[];
  axes: readonly number[];
}
// Standard gamepad layout: A or d-pad up jumps, B or d-pad down slides, Start pauses.
export function padState(pads: readonly (PadLike | null)[]) {
  const out = {jump: false, slide: false, pause: false, press: false, up: false, down: false};
  for (const pad of pads) {
    if (!pad) continue;
    const b = (i: number) => !!pad.buttons[i]?.pressed,
      x = pad.axes[0] ?? 0,
      y = pad.axes[1] ?? 0;
    out.jump ||= b(0) || b(12) || y < -0.6;
    out.slide ||= b(1) || b(13) || y > 0.6;
    out.pause ||= b(9);
    out.press ||= b(0);
    out.up ||= b(12) || b(14) || y < -0.6 || x < -0.6;
    out.down ||= b(13) || b(15) || y > 0.6 || x > 0.6;
  }
  return out;
}
type Pad = ReturnType<typeof padState>;
// Whether a gamepad has spoken to this page (browsers list one only after a button press).
export const padConnected = () => typeof navigator !== 'undefined' && !!navigator.getGamepads?.().some(Boolean);
export class Controls {
  private pad: Pad = padState([]);
  private polling = 0;
  private keys = new Set<string>();
  private pointers = new Map<number, 'jump' | 'slide'>();
  private buttonKeys = new Map<string, 'jump' | 'slide'>();
  private latched = false;
  private abort = new AbortController();
  private buttonAbort = new AbortController();
  constructor(private actions: Actions) {
    const options = {signal: this.abort.signal};
    window.addEventListener(
      'keydown',
      e => {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          if (!(actions.pauseActive?.() ?? actions.active()) || e.repeat || this.keys.has(e.code)) return;
          e.preventDefault();
          this.keys.add(e.code);
          actions.pause();
          return;
        }
        if (!actions.active()) return;
        // Let focused semantic buttons handle Space and Enter exactly once, including Pause.
        if (
          (e.code === 'Space' || JUMP_KEYS.includes(e.code)) &&
          (e.target as Element | null)?.closest?.('button,input,select,textarea,[contenteditable="true"]')
        )
          return;
        if (['Space', 'ArrowUp', 'ArrowDown', ...JUMP_KEYS].includes(e.code)) e.preventDefault();
        if (e.repeat || this.keys.has(e.code)) return;
        this.keys.add(e.code);
        if (e.code === 'Space' || e.code === 'ArrowUp' || JUMP_KEYS.includes(e.code)) this.jump();
        if (e.code === 'ArrowDown') this.press();
      },
      options,
    );
    window.addEventListener(
      'keyup',
      e => {
        this.keys.delete(e.code);
        const button = this.buttonKeys.delete(e.code);
        if (e.code === 'ArrowDown' || button) this.syncSlide();
      },
      options,
    );
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.syncSlide();
    };
    window.addEventListener('pointerup', up, options);
    window.addEventListener('pointercancel', up, options);
    // Gamepads are read only after one connects, then every frame while any is connected.
    window.addEventListener('gamepadconnected', () => this.poll(), options);
    // A pad connected before the game started (another tab, a reload) sends no new event.
    if (typeof navigator !== 'undefined' && navigator.getGamepads?.().some(Boolean)) this.poll();
  }
  private poll() {
    if (this.polling || this.abort.signal.aborted || typeof requestAnimationFrame === 'undefined') return;
    const step = () => {
      const pads = navigator.getGamepads?.() ?? [];
      if (this.abort.signal.aborted || !pads.some(Boolean)) {
        this.polling = 0;
        this.padInput(padState([]));
        return;
      }
      this.padInput(padState(pads));
      this.polling = requestAnimationFrame(step);
    };
    this.polling = requestAnimationFrame(step);
  }
  // Applies a gamepad reading; only changes since the last reading act, like key presses.
  padInput(next: Pad) {
    const was = this.pad,
      a = this.actions;
    this.pad = next;
    if (next.pause && !was.pause && (a.pauseActive?.() ?? a.active())) a.pause();
    if (a.active()) {
      if (next.jump && !was.jump) this.jump();
      if (next.slide && !was.slide) this.press();
      else if (!next.slide && was.slide) this.syncSlide();
      return;
    }
    if (was.slide && !next.slide) this.syncSlide();
    // Menus: the d-pad moves between buttons and A presses the one in focus.
    if (typeof document === 'undefined') return;
    const back = next.up && !was.up,
      forward = next.down && !was.down;
    if (back || forward) {
      const all = [
        ...document.querySelectorAll<HTMLElement>('#ui button:not(:disabled), #ui a[href], #ui [data-action]'),
      ].filter(el => el.checkVisibility?.({visibilityProperty: true, opacityProperty: true}) ?? true);
      const at = all.indexOf(document.activeElement as HTMLElement),
        step = forward ? 1 : -1;
      // Some buttons take no focus where they are hidden by layout; move past them.
      for (let i = 1, from = at < 0 ? (forward ? -1 : 0) : at; i <= all.length; i++) {
        const el = all[(((from + step * i) % all.length) + all.length) % all.length];
        el.focus();
        if (document.activeElement === el) break;
      }
    }
    if (next.press && !was.press) (document.activeElement as HTMLElement | null)?.click?.();
  }
  bind(root: HTMLElement) {
    this.buttonAbort.abort();
    this.buttonAbort = new AbortController();
    root.querySelectorAll<HTMLElement>('[data-control]').forEach(button => {
      button.addEventListener(
        'pointerdown',
        e => {
          e.preventDefault();
          if (!this.actions.active() || this.pointers.has(e.pointerId)) return;
          const type = button.dataset.control as 'jump' | 'slide';
          this.pointers.set(e.pointerId, type);
          button.setPointerCapture?.(e.pointerId);
          if (type === 'jump') this.jump();
          else this.press();
        },
        {signal: this.buttonAbort.signal},
      );
      button.addEventListener(
        'lostpointercapture',
        e => {
          this.pointers.delete(e.pointerId);
          this.syncSlide();
        },
        {signal: this.buttonAbort.signal},
      );
      // Keyboard activation of the semantic buttons. Touch never generates another action via click.
      button.addEventListener(
        'keydown',
        e => {
          if (e.code !== 'Enter' && e.code !== 'Space') return;
          e.preventDefault();
          if (!this.actions.active() || e.repeat || this.buttonKeys.has(e.code)) return;
          const type = button.dataset.control as 'jump' | 'slide';
          this.buttonKeys.set(e.code, type);
          if (type === 'jump') this.jump();
          else this.press();
        },
        {signal: this.buttonAbort.signal},
      );
    });
  }
  private jump() {
    if (this.latched) {
      this.latched = false;
      this.syncSlide();
    }
    this.actions.jump();
  }
  private press() {
    if (this.actions.slideToggle?.()) this.latched = !this.latched;
    this.syncSlide();
  }
  private syncSlide() {
    if (this.actions.slideToggle?.()) {
      this.actions.slide(this.latched);
      return;
    }
    this.actions.slide(
      this.keys.has('ArrowDown') ||
        [...this.pointers.values()].includes('slide') ||
        [...this.buttonKeys.values()].includes('slide') ||
        this.pad.slide,
    );
  }
  clear() {
    this.buttonAbort.abort();
    this.keys.clear();
    this.pointers.clear();
    this.buttonKeys.clear();
    this.latched = false;
    this.actions.slide(false);
  }
  destroy() {
    this.clear();
    this.abort.abort();
    if (this.polling) cancelAnimationFrame(this.polling);
  }
}
