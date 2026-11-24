// Keeps the screen on while a run is being played: classroom tablets often dim and lock after
// 30 seconds to a minute without a touch, and a run of jumps on the keyboard or a switch is not
// a touch. Released on every pause, result and hidden page; the browser also drops it whenever
// the page is hidden, so playing again asks for it again.
type Sentinel = {released: boolean; release(): Promise<void>; addEventListener(t: 'release', f: () => void): void};
type WakeNav = Navigator & {wakeLock?: {request(type: 'screen'): Promise<Sentinel>}};
export const wakeLockSupported = () => typeof navigator !== 'undefined' && !!(navigator as WakeNav).wakeLock;
export class ScreenAwake {
  private sentinel: Sentinel | null = null;
  private wanted = false;
  // Whether the screen is held on right now (for the device status in the settings).
  get held() {
    return !!this.sentinel && !this.sentinel.released;
  }
  keep(on: boolean) {
    this.wanted = on;
    if (!on) {
      const s = this.sentinel;
      this.sentinel = null;
      if (s && !s.released) s.release().catch(() => {});
      return;
    }
    if (this.held || !wakeLockSupported() || (typeof document !== 'undefined' && document.hidden)) return;
    (navigator as WakeNav)
      .wakeLock!.request('screen')
      .then(s => {
        // Paused while the request was on its way.
        if (!this.wanted) {
          s.release().catch(() => {});
          return;
        }
        this.sentinel = s;
        s.addEventListener('release', () => {
          if (this.sentinel === s) this.sentinel = null;
        });
      })
      .catch(() => {});
  }
}
