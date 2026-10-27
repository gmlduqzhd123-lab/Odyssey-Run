import type {StageId} from './courses';
export const ADVENTURE_BALANCE = {glideMagnet: 240, guardianRange: 300, nearDistance: 18} as const;
export const GOALS = {
  maps: {name: '지도 탐험가', description: '이번 판 지도 2개 찾기', target: 2},
  dodge: {name: '지혜로운 회피', description: '몬스터 3마리를 직접 피하기', target: 3},
  sky: {name: '별자리 항해사', description: '별자리 1개 완성하기', target: 1},
  story: {name: '이야기 수집가', description: '숨은 이야기 1개 발견하기', target: 1},
} as const;
export type GoalId = keyof typeof GOALS;
export const COMBOS = {
  glide: {name: '별빛 활공', description: '날개 + 자석: 별빛 수집 반경이 160→240px!'},
  guardian: {name: '빛의 삼지창', description: '등불 + 삼지창: 격퇴 범위가 200→300px!'},
} as const;
export type ComboId = keyof typeof COMBOS;
export interface Branch {
  id: string;
  start: number;
  end: number;
  y: number;
}
export interface Constellation {
  id: string;
  name: string;
  shape: 'ship' | 'owl' | 'crown';
  stars: string[];
}
export interface Discovery {
  id: string;
  x: number;
  y: number;
  pose: 'upper' | 'duck';
  title: string;
  quote: string;
  story: string;
}
export interface Highlight {
  id: string;
  start: number;
  end: number;
  name: string;
  hint: string;
}
export interface AdventurePlan {
  branch: Branch;
  constellations: Constellation[];
  stories: Discovery[];
  highlight: Highlight;
}
export function adventurePlan(stage: StageId): AdventurePlan {
  const start = stage === 'cave' ? 7540 : 4140,
    end = stage === 'cave' ? 8000 : 4740;
  const titles = {
    beach: ['나우시카의 리본', '선원의 작은 약속'],
    cave: ['아무도 아닌 이름', '조언자의 등불'],
    wind: ['바람의 편지', '길잡이의 별'],
    sea: ['밀랍 귀마개', '돛대의 약속'],
  }[stage];
  const words = {
    beach: [
      [
        '푸른 리본이 귀환의 방향을 알려 줘요.',
        '나우시카는 도움을 준 뒤 푸른 리본을 남겼어요. 낯선 해변에서도 누군가의 친절은 다음 항해를 시작할 힘이 되었지요.',
      ],
      [
        '작은 약속이 먼 바다를 건너게 해요.',
        '선원은 부두 아래에 약속을 새겼어요. “별을 함께 세면 길을 잃지 않아.” 오디세우스는 고향에서 다시 만나자고 답했어요.',
      ],
    ],
    cave: [
      [
        '아무도 아닌 이름에 지혜가 숨어 있어요.',
        '오디세우스는 거인에게 자신을 “아무도”라고 소개했어요. 거인이 도움을 청해도 친구들은 누구에게 당했는지 알 수 없었지요. 큰 힘보다 생각이 빛난 순간이에요.',
      ],
      [
        '작은 등불은 위험을 먼저 보여 줘요.',
        '조언자는 동굴 벽에 적었어요. “앞만 보지 말고, 그림자가 가리키는 곳도 살펴라.” 작은 등불은 두려움을 없애기보다 피할 길을 먼저 보여 주었어요.',
      ],
    ],
    wind: [
      [
        '바람은 빌려도 방향은 스스로 정해요.',
        '아이올로스는 순풍을 선물하며 말했어요. “내가 빌려 주는 것은 바람이다. 돌아갈 곳을 기억하는 일은 너의 몫이지.” 오디세우스는 구름 사이로 고향을 떠올렸어요.',
      ],
      [
        '고향의 별은 기다리는 사람을 비춰요.',
        '길잡이는 낮은 돌에 별 세 개를 새겼어요. 첫 별은 배, 둘째 별은 등대, 셋째 별은 기다리는 가족을 뜻했어요. 항해의 끝에는 장소보다 사람이 기다리고 있었지요.',
      ],
    ],
    sea: [
      [
        '귀를 막으면 마음의 방향을 지킬 수 있어요.',
        '세이렌의 노래는 듣는 사람을 바위섬으로 끌어당겼어요. 오디세우스는 선원들의 귀를 밀랍으로 막아 주었어요. 함께 정한 약속이 모두를 지켜 주었지요.',
      ],
      [
        '스스로를 묶는 용기도 있어요.',
        '오디세우스는 노래를 듣고 싶었지만 자신을 돛대에 단단히 묶어 달라고 부탁했어요. “내가 풀어 달라고 하면 더 꽁꽁 묶어 주게.” 배는 노래를 지나 무사히 나아갔어요.',
      ],
    ],
  }[stage];
  const stories = [
    {
      id: `${stage}-story-1`,
      x: (start + end) / 2,
      y: 330,
      pose: 'upper' as const,
      title: titles[0],
      quote: '발견 · ' + words[0][0],
      story: words[0][1],
    },
    {
      id: `${stage}-story-2`,
      x: stage === 'beach' ? 16750 : stage === 'cave' ? 17300 : stage === 'sea' ? 16850 : 18800,
      y: 440,
      pose: 'duck' as const,
      title: titles[1],
      quote: '발견 · ' + words[1][0],
      story: words[1][1],
    },
  ];
  const groups = [3, 6, 17],
    names = ['귀환의 배', '아테나의 부엉이', '이타카의 왕관'];
  return {
    branch: {id: `${stage}-branch`, start, end, y: 330},
    stories,
    constellations: groups.map((group, i) => ({
      id: `${stage}-constellation-${i + 1}`,
      name: names[i],
      shape: (['ship', 'owl', 'crown'] as const)[i],
      stars: Array.from({length: 5}, (_, j) => `${stage}-star-${group * 5 + j + 1}`),
    })),
    highlight:
      stage === 'beach'
        ? {id: 'beach-pier', start: 7800, end: 9100, name: '무너지는 부두', hint: '갈라진 널빤지를 보고 2단 점프!'}
        : stage === 'cave'
          ? {
              id: 'cave-hand',
              start: 12700,
              end: 14100,
              name: '거인의 손을 피해!',
              hint: '손 아래로 숙인 뒤 끊어진 길에서 점프!',
            }
          : stage === 'sea'
            ? {
                id: 'sea-sirens',
                start: 12700,
                end: 14200,
                name: '세이렌의 노래',
                hint: '노래에 끌리지 말고 2단 점프로 바다를 건너요!',
              }
            : {
                id: 'wind-clouds',
                start: 19200,
                end: 20750,
                name: '구름 징검다리',
                hint: '바람과 2단 점프로 높은 구름길에 도전!',
              },
  };
}
export const ADVENTURE_PLANS = {
  beach: adventurePlan('beach'),
  cave: adventurePlan('cave'),
  wind: adventurePlan('wind'),
  sea: adventurePlan('sea'),
};
export const storyIds = Object.values(ADVENTURE_PLANS).flatMap(p => p.stories.map(s => s.id));
export const constellationIds = Object.values(ADVENTURE_PLANS).flatMap(p => p.constellations.map(s => s.id));
export const routeIds = Object.keys(ADVENTURE_PLANS).flatMap(id => [`${id}-upper`, `${id}-lower`]);
export const stampIds = Object.keys(ADVENTURE_PLANS).flatMap(id => Object.keys(GOALS).map(goal => `${id}-${goal}`));
