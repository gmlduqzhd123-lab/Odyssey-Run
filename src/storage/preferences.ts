export type Quality = 'auto' | 'high' | 'low';
export interface TouchLayout {
  size: number;
  bottom: number;
  inset: number;
  opacity: number;
  swapped: boolean;
}
export const PACES = [1, 0.9, 0.8, 0.7] as const;
export type Pace = (typeof PACES)[number];
// Easy-voyage assists slow game time uniformly, so every jump and gap stays reachable.
export interface Assist {
  pace: Pace;
  slideToggle: boolean;
  autoSlide: boolean;
}
export interface Preferences {
  quality: Quality;
  assist: Assist;
  haptics: boolean;
  touch: TouchLayout;
  cape: 'classic' | 'sea' | 'royal';
  emblem: 'plain' | 'owl' | 'star';
  sail: 'plain' | 'sun' | 'festival';
}
export const defaultPreferences = (): Preferences => ({
  quality: 'auto',
  assist: {pace: 1, slideToggle: false, autoSlide: false},
  haptics: true,
  touch: {size: 80, bottom: 0, inset: 0, opacity: 0.85, swapped: false},
  cape: 'classic',
  emblem: 'plain',
  sail: 'plain',
});
export function readPreferences(raw: unknown): Preferences {
  const out = defaultPreferences();
  if (raw === undefined) return out;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('맞춤 설정 형식이 올바르지 않아요.');
  const v = raw as Record<string, unknown>,
    t = v.touch as Record<string, unknown>;
  const choice = (value: unknown, allowed: readonly string[]) => {
    if (typeof value !== 'string' || !allowed.includes(value)) throw Error('맞춤 설정의 선택값을 확인해 주세요.');
    return value;
  };
  out.quality = choice(v.quality, ['auto', 'high', 'low']) as Quality;
  out.cape = choice(v.cape, ['classic', 'sea', 'royal']) as Preferences['cape'];
  out.emblem = choice(v.emblem, ['plain', 'owl', 'star']) as Preferences['emblem'];
  out.sail = choice(v.sail, ['plain', 'sun', 'festival']) as Preferences['sail'];
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw Error('터치 버튼 설정을 확인해 주세요.');
  for (const [key, min, max] of [
    ['size', 64, 112],
    ['bottom', 0, 60],
    ['inset', 0, 20],
    ['opacity', 0.4, 1],
  ] as const) {
    const n = t[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max)
      throw Error('터치 버튼 크기·위치·투명도 범위를 확인해 주세요.');
    out.touch[key] = n;
  }
  if (typeof t.swapped !== 'boolean') throw Error('버튼 좌우 설정을 확인해 주세요.');
  out.touch.swapped = t.swapped;
  if (v.haptics !== undefined) {
    if (typeof v.haptics !== 'boolean') throw Error('진동 설정을 확인해 주세요.');
    out.haptics = v.haptics;
  }
  // Saves written before easy voyages have no assist block; keep the defaults.
  if (v.assist !== undefined) {
    const a = v.assist as Record<string, unknown>;
    if (!a || typeof a !== 'object' || Array.isArray(a) || !PACES.includes(a.pace as Pace))
      throw Error('쉬운 항해 속도를 확인해 주세요.');
    if (typeof a.slideToggle !== 'boolean' || typeof a.autoSlide !== 'boolean')
      throw Error('쉬운 항해 조작 설정을 확인해 주세요.');
    out.assist = {pace: a.pace as Pace, slideToggle: a.slideToggle, autoSlide: a.autoSlide};
  }
  return out;
}
