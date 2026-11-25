import {SAVE_KEY} from './save';
import type {Assist} from './preferences';
// Lesson presets: one choice on the shared device sets the easy-voyage help, whether weather and
// blessings can be picked, for every sailor until it is turned off. Kept on the device (not in a
// sailor's record) and changed behind the teacher's lock.
export const PRESET_KEY = SAVE_KEY + ':lesson-preset';
export const PRESETS = {
  easy: {
    name: '저학년 쉬운 항해',
    description: '속도 0.8배 · 슬라이드 한 번 눌러 유지 · 날씨 없음 · 축복 고르기 가능',
    assist: {pace: 0.8, slideToggle: true, autoSlide: false},
    weather: false,
    blessing: true,
  },
  normal: {
    name: '보통 수업',
    description: '보통 속도 · 날씨 없음 · 축복 고르기 가능',
    assist: {pace: 1, slideToggle: false, autoSlide: false},
    weather: false,
    blessing: true,
  },
  challenge: {
    name: '도전 수업',
    description: '보통 속도 · 날씨 고르기 가능 · 축복 없이',
    assist: {pace: 1, slideToggle: false, autoSlide: false},
    weather: true,
    blessing: false,
  },
} as const satisfies Record<
  string,
  {name: string; description: string; assist: Assist; weather: boolean; blessing: boolean}
>;
export type PresetId = keyof typeof PRESETS;
export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
export const isPreset = (v: unknown): v is PresetId => typeof v === 'string' && Object.hasOwn(PRESETS, v);
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
export function readPreset(storage: Store): PresetId | null {
  try {
    const v = storage?.getItem(PRESET_KEY);
    return isPreset(v) ? v : null;
  } catch {
    return null;
  }
}
export function writePreset(storage: Store, id: PresetId | null) {
  try {
    if (id) storage?.setItem(PRESET_KEY, id);
    else storage?.removeItem(PRESET_KEY);
  } catch {}
}
