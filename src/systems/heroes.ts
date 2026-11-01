import type {Save} from '../storage/save';
// Who runs the voyage. Every hero moves, jumps and scores exactly alike; only the look and the
// words change. Unlocked by what a sailor has found, never bought with points.
export const HEROES = [
  {
    id: 'odysseus',
    name: '오디세우스',
    eyebrow: 'ODYSSEUS',
    title: '지혜로운 작은 영웅',
    line: '“이번에는 꼭, 이타카로!”',
    start: '이타카로 가는 여정, 출발!',
    requirement: '처음부터 함께해요',
    tint: 0xffffff,
  },
  {
    id: 'telemachus',
    name: '텔레마코스',
    eyebrow: 'TELEMACHUS',
    title: '아버지를 찾아 나선 아들',
    line: '“아버지의 발자취를 따라갈래요!”',
    start: '아버지의 소식을 찾아, 출발!',
    requirement: '지도 조각 6개 발견',
    tint: 0xdcefd6,
  },
  {
    id: 'penelope',
    name: '페넬로페',
    eyebrow: 'PENELOPE',
    title: '지혜롭게 기다리는 왕비',
    line: '“기다림도 용기가 필요해요.”',
    start: '베틀의 지혜를 품고, 출발!',
    requirement: '숨은 이야기 4개 발견',
    tint: 0xf6dceb,
  },
  {
    id: 'athena',
    name: '아테나 (변장)',
    eyebrow: 'ATHENA',
    title: '항해자로 변장한 지혜의 여신',
    line: '“지혜는 가장 좋은 방패란다.”',
    start: '부엉이의 눈으로 길을 살펴요, 출발!',
    requirement: '신화 퀴즈 10문제 맞히기',
    tint: 0xe2e4f6,
  },
] as const;
export type HeroId = (typeof HEROES)[number]['id'];
export const HERO_IDS = HEROES.map(h => h.id) as readonly HeroId[];
export const heroInfo = (id: HeroId) => HEROES.find(h => h.id === id)!;
export function heroUnlocked(s: Save, id: HeroId) {
  const maps = Object.values(s.stages).reduce((n, r) => n + r.maps.length, 0);
  return (
    id === 'odysseus' ||
    (id === 'telemachus' && maps >= 6) ||
    (id === 'penelope' && s.journal.stories.length >= 4) ||
    (id === 'athena' && s.quiz.length >= 10)
  );
}
