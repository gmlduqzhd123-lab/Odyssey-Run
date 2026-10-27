export type Quality = 'auto' | 'high' | 'low';
export interface TouchLayout {
  size: number;
  bottom: number;
  inset: number;
  opacity: number;
  swapped: boolean;
}
export interface Preferences {
  quality: Quality;
  touch: TouchLayout;
  cape: 'classic' | 'sea' | 'royal';
  emblem: 'plain' | 'owl' | 'star';
  sail: 'plain' | 'sun' | 'festival';
}
export const defaultPreferences = (): Preferences => ({
  quality: 'auto',
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
  return out;
}
