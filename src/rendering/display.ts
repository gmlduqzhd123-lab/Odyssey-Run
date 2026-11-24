import type {Quality} from '../storage/preferences';
// Rendering pixels are independent of the 960 × 540 simulation and logical view.
// Match native display pixels without oversampling, bounded for large displays.
export const DISPLAY = {
  maxDensity: 4,
  maxPixels: 3840 * 2160,
  maxDeviceRatio: 2,
  svgDensity: 2,
  farParallax: 0,
  nearParallax: 0,
} as const;
// minWidth narrows the logical view (zooming in) for the portrait game strip; the hero keeps
// at least 192 logical px behind it, so about 1.6 s of the course ahead stays in view.
export function displayViewport(width: number, height: number, minWidth = 960) {
  const w = Math.max(1, width),
    h = Math.max(1, height),
    scale = Math.min(w / minWidth, h / 540);
  return {
    width: w / scale,
    height: h / scale,
    scale,
    extraHeight: h / scale - 540,
    heroX: Math.max(192, (w / scale) * 0.2),
  };
}
export type DisplayViewport = ReturnType<typeof displayViewport>;
export function displayDensity(
  width: number,
  deviceRatio: number,
  height = (width * 9) / 16,
  quality: Quality = 'high',
  // "Auto" quality's step on this device (see rendering/frame-watch AUTO_STEPS): 1 lighter, 2 light.
  autoStep = 0,
) {
  const low =
      quality === 'low' ||
      (quality === 'auto' &&
        (autoStep >= 2 ||
          (typeof navigator !== 'undefined' &&
            ((navigator as Navigator & {deviceMemory?: number}).deviceMemory ?? 8) <= 2))),
    lighter = !low && quality === 'auto' && autoStep === 1;
  const view = displayViewport(width, height),
    needed = view.scale * Math.min(low ? 1 : lighter ? 1.5 : DISPLAY.maxDeviceRatio, Math.max(1, deviceRatio || 1));
  return Math.min(
    DISPLAY.maxDensity,
    Math.sqrt((low ? 1920 * 1080 : lighter ? 2560 * 1440 : DISPLAY.maxPixels) / (view.width * view.height)),
    needed,
  );
}
