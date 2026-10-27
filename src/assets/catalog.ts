import {ART_FILES} from './files';
export function assetUrl(name: string) {
  const file = ART_FILES[name as keyof typeof ART_FILES];
  return `${import.meta.env.BASE_URL}${file ?? `assets/${name}.svg`}`;
}
export const PEOPLE = [
  {
    id: 'odysseus',
    name: '오디세우스',
    role: '이타카로 돌아가는 영웅',
    story: '이 모험의 주인공이에요. 용기와 지혜로 네 섬을 지나 고향 이타카로 돌아가요.',
  },
  {
    id: 'penelope',
    name: '페넬로페',
    role: '이타카에서 기다리는 가족',
    story: '오디세우스의 아내예요. 긴 항해 끝에 돌아갈 고향에는 소중한 가족이 기다리고 있어요.',
  },
  {
    id: 'telemachus',
    name: '텔레마코스',
    role: '용기 있는 아들',
    story: '오디세우스의 아들이에요. 아버지의 소식을 찾아 나서며 용기를 배웠어요.',
  },
  {
    id: 'athena',
    name: '아테나',
    role: '지혜의 여신',
    story: '오디세우스의 여정을 돕는 지혜의 여신이에요. 부엉이 방패가 영웅을 한 번 지켜 줘요.',
  },
  {
    id: 'hermes',
    name: '헤르메스',
    role: '날개 달린 전령',
    story: '빠르게 소식을 전하는 신이에요. 날개 신발을 얻으면 잠시 낙하가 느려져요.',
  },
  {
    id: 'aeolus',
    name: '아이올로스',
    role: '바람의 주인',
    story: '바람을 다스리는 인물이에요. 세 번째 섬에서는 눈에 보이는 바람길을 타고 높이 떠올라요.',
  },
  {
    id: 'nausicaa',
    name: '나우시카',
    role: '해변에서 만난 친구',
    story: '항해 중 낯선 해변에 도착한 오디세우스를 도와준 인물이에요. 친절한 만남도 귀환의 힘이 돼요.',
  },
  {
    id: 'sailor',
    name: '항해 동료',
    role: '함께 길을 찾는 선원',
    story: '거센 바다에서도 함께 배를 이끄는 동료예요. 이 이야기에서는 안전한 항로를 알려 줘요.',
  },
  {
    id: 'counsellor',
    name: '지혜의 조언자',
    role: '생각하는 힘을 알려 주는 친구',
    story: '이 게임의 안내 인물이에요. 서두르기보다 장애물과 별빛의 길을 먼저 살펴보라고 이야기해요.',
  },
  {
    id: 'navigator',
    name: '별빛 길잡이',
    role: '지도를 읽는 탐험가',
    story: '이 게임의 안내 인물이에요. 열두 조각의 지도를 모으며 이타카로 가는 길을 찾아요.',
  },
] as const;
export const RELICS = [
  {
    id: 'shield',
    name: '아테나의 방패',
    kind: '달리기 아이템',
    description: '일반 장애물의 피해를 한 번 막아요. 추락은 막지 못해요.',
  },
  {
    id: 'wings',
    name: '헤르메스의 날개 신발',
    kind: '달리기 아이템',
    description: '6초 동안 천천히 내려와요. 자동으로 솟아오르거나 점프 횟수를 늘리지는 않아요.',
  },
  {
    id: 'magnet',
    name: '별빛 자석',
    kind: '달리기 아이템',
    description: '6초 동안 가까운 별빛을 모아요. 지도는 직접 닿아야 해요.',
  },
  {
    id: 'apple',
    name: '황금 사과',
    kind: '달리기 아이템',
    description: '체력을 한 칸 회복해요. 최대 체력은 세 칸이에요.',
  },
  {
    id: 'map',
    name: '지도 조각',
    kind: '달리기 아이템',
    description: '한 조각에 100점! 섬마다 세 조각을 모으면 귀환의 이야기가 완성돼요.',
  },
  {
    id: 'wind-bag',
    name: '바람 자루',
    kind: '항해의 상징',
    description: '아이올로스의 바람 섬을 상징해요. 바람길은 위를 향한 화살표로도 표시돼요.',
  },
  {
    id: 'trident',
    name: '바다의 삼지창',
    kind: '달리기 아이템',
    description: '가까운 몬스터 한 마리와 그 공격을 자동으로 격퇴해요. 최대 한 개만 보유하며 추가 점수는 없어요.',
  },
  {
    id: 'laurel',
    name: '귀환의 월계관',
    kind: '항해의 상징',
    description: '한 섬을 끝까지 달린 용기를 축하해요. 완주 결과 화면에 표시돼요.',
  },
  {
    id: 'compass',
    name: '별빛 나침반',
    kind: '달리기 아이템',
    description: '방금 지난 평평한 곳을 추락 복귀 지점으로 갱신해요. 추락 피해는 그대로이며 추가 점수는 없어요.',
  },
  {
    id: 'lantern',
    name: '동굴의 등불',
    kind: '달리기 아이템',
    description:
      '6초 동안 하르피아·망령과 날아오는 바위를 막아요. 다시 얻으면 6초로 갱신해요. 다른 장애물과 추락은 막지 못해요.',
  },
] as const;
export const STAGE_RELIC = {beach: 'trident', cave: 'lantern', wind: 'wind-bag', sea: 'compass'} as const;
