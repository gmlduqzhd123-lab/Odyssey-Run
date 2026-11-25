import type {Save} from '../storage/save';
// Who runs the voyage. Unlocked by what a sailor has found, never bought with points. Each has one
// small ability on ordinary island runs (see player/runner ability); everywhere else — and in every
// score — the heroes are exactly alike.
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
    ability: '지혜: 피버 게이지가 조금 더 빨리 차요',
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
    ability: '젊은 다리: 2단 점프가 조금 더 높아요',
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
    ability: '인내: 돌발 미션 시간이 2초 더 길어요',
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
    ability: '방패의 여신: 방패 하나로 두 번 막아요',
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
