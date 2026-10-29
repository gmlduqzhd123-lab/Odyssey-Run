// The device's own accessibility settings: reduced motion, more contrast and larger text.
// They apply without a visit to the game's settings and follow changes while the game is open.
const matches = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
export const deviceReducedMotion = () => matches('(prefers-reduced-motion: reduce)');
export const deviceContrast = () => matches('(prefers-contrast: more)') || matches('(forced-colors: active)');
// A browser set to a larger default font raises the root font size above 16px. Menu pages are
// sized in px, so they are scaled by that ratio (capped so two columns still fit).
export const textScale = (rootPx: number) => Math.min(1.4, Math.max(1, Math.round((rootPx / 16) * 20) / 20));
export function followDevice(app: HTMLElement, signal?: AbortSignal) {
  const apply = () => {
    const scale = textScale(parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    app.toggleAttribute('data-contrast', deviceContrast());
    app.toggleAttribute('data-large-text', scale > 1);
    app.style.setProperty('--text-scale', String(scale));
  };
  apply();
  if (typeof matchMedia !== 'function') return;
  for (const q of ['(prefers-reduced-motion: reduce)', '(prefers-contrast: more)', '(forced-colors: active)'])
    matchMedia(q).addEventListener('change', apply, {signal});
}
