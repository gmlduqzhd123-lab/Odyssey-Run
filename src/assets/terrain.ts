import {TERRAIN_FILES} from './terrain-files';
import type {StageId} from '../levels/courses';
export type SheetId = keyof typeof TERRAIN_FILES;
export const sheetUrl = (id: SheetId) => `${import.meta.env.BASE_URL}${TERRAIN_FILES[id]}`;
export type Region = {sheet: SheetId; x: number; y: number; w: number; h: number};
// The source sheets are opaque illustrated pages, not transparent sprite atlases.
// Select solid interior textures and scenery; never include captions in gameplay.
export const REGIONS = {
  'ground-beach': {sheet: 'terrain-sheet', x: 46, y: 153, w: 239, h: 33},
  'ground-cave': {sheet: 'terrain-sheet', x: 42, y: 317, w: 241, h: 42},
  'ground-wind': {sheet: 'terrain-sheet', x: 36, y: 394, w: 255, h: 25},
  'wood-platform': {sheet: 'terrain-sheet', x: 693, y: 207, w: 161, h: 15},
  'view-beach': {sheet: 'landscape-sheet', x: 8, y: 49, w: 750, h: 140},
  'view-cave': {sheet: 'landscape-sheet', x: 8, y: 245, w: 750, h: 147},
  'view-wind': {sheet: 'landscape-sheet', x: 779, y: 245, w: 749, h: 147},
  'view-ithaca': {sheet: 'landscape-sheet', x: 8, y: 869, w: 750, h: 145},
} satisfies Record<string, Region>;
export const STAGE_VIEW: Record<StageId, keyof typeof REGIONS> = {
  beach: 'view-beach',
  cave: 'view-cave',
  wind: 'view-wind',
};
export function regionArt(name: keyof typeof REGIONS, className: string, label = '') {
  const r = REGIONS[name];
  return `<svg class="${className}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}" preserveAspectRatio="xMidYMid slice" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><image href="${sheetUrl(r.sheet)}" width="1536" height="1024"/></svg>`;
}
export const ART_SHEETS = [
  {
    id: 'terrain-sheet',
    name: '지형과 오브젝트',
    description: '발판, 낮은 천장, 낭떠러지와 소품을 그린 원화예요. 달리는 길의 모래·바위·유적 무늬에 사용했어요.',
  },
  {
    id: 'landscape-sheet',
    name: '신화의 섬과 항구',
    description:
      '출항의 해변, 키클롭스의 동굴, 바람 섬과 도착 항구의 풍경이에요. 이번 항로는 세 섬을 지나 이타카로 이어져요.',
  },
  {
    id: 'enemy-sheet',
    name: '바다 건너의 몬스터',
    description: '키클롭스, 스킬라와 카리브디스 등 바다 전설의 원화예요. 동굴의 거인은 체력이 줄수록 가까이 다가와요.',
  },
  {
    id: 'myth-sheet',
    name: '오디세이의 전설',
    description: '세이렌, 하르피아와 미노타우로스 등 신화 속 존재를 만나 보세요.',
  },
  {
    id: 'sea-sheet',
    name: '깊은 바다의 전설',
    description: '바다의 괴물과 수호령을 그린 또 다른 원화예요. 모험을 마친 뒤 천천히 살펴보세요.',
  },
] as const satisfies readonly {id: SheetId; name: string; description: string}[];
