import type {Save} from '../storage/save';
export const COSMETICS = [
  {slot: 'cape', id: 'classic', name: '영웅의 붉은 망토', requirement: '처음부터 사용', color: '#b65b3c'},
  {slot: 'cape', id: 'sea', name: '푸른 바다 망토', requirement: '출항의 해변 완주', color: '#277d94'},
  {
    slot: 'cape',
    id: 'royal',
    name: '이타카의 보랏빛 망토',
    requirement: '해변·동굴·바람 섬 모두 완주',
    color: '#79549b',
  },
  {slot: 'emblem', id: 'plain', name: '기본 문양', requirement: '처음부터 사용', color: '#d8b861'},
  {slot: 'emblem', id: 'owl', name: '아테나의 부엉이 문양', requirement: '지도 조각 3개 발견', color: '#e5d2a0'},
  {slot: 'emblem', id: 'star', name: '별자리 문양', requirement: '별자리 3개 완성', color: '#f0d06c'},
  {slot: 'sail', id: 'plain', name: '하얀 돛', requirement: '처음부터 사용', color: '#fff0cb'},
  {slot: 'sail', id: 'sun', name: '황금빛 귀환의 돛', requirement: '도전 도장 3개 획득', color: '#e6b950'},
  {
    slot: 'sail',
    id: 'festival',
    name: '축제의 푸른 돛',
    requirement: '해변·동굴·바람 섬 완주 + 도전 도장 3개',
    color: '#4a9fa6',
  },
] as const;
export function cosmeticUnlocked(s: Save, id: string) {
  // The original three islands keep unlocking these, so cosmetics already earned stay valid.
  const maps = Object.values(s.stages).reduce((n, r) => n + r.maps.length, 0),
    done = (['beach', 'cave', 'wind'] as const).every(id => s.stages[id].complete);
  return (
    ['classic', 'plain'].includes(id) ||
    (id === 'sea' && s.stages.beach.complete) ||
    (id === 'royal' && done) ||
    (id === 'owl' && maps >= 3) ||
    (id === 'star' && s.journal.constellations.length >= 3) ||
    (id === 'sun' && s.journal.stamps.length >= 3) ||
    (id === 'festival' && done && s.journal.stamps.length >= 3)
  );
}
export const sailColor = (id: string) => COSMETICS.find(c => c.slot === 'sail' && c.id === id)?.color ?? '#fff0cb';
