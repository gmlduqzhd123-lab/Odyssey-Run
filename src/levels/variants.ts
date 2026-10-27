import {C} from '../config';
import {COURSES, STAGES, safePoints, type StageId, type Course} from './courses';
import {ADVENTURE_PLANS} from './adventure';
import {VARIANTS, type VariantId} from './course-ids';

export const VARIANT_LABELS: Record<StageId, Record<VariantId, {name: string; description: string}>> = {
  beach: {
    classic: {name: '기본 항로', description: '익숙한 해변에서 첫 항해를 시작해요.'},
    'remix-a': {name: '유적 순례길', description: '유적과 부두를 새로운 순서로 찾아가요.'},
    'remix-b': {name: '별빛 해안길', description: '별빛을 따라 달라진 해안의 위험을 살펴봐요.'},
  },
  cave: {
    classic: {name: '기본 항로', description: '동굴의 빛을 따라 익숙한 길로 달려요.'},
    'remix-a': {name: '횃불 회랑', description: '횃불 너머 다른 순서로 나타나는 거인을 피해요.'},
    'remix-b': {name: '거인의 미로', description: '낙석과 낮은 문을 지나 새로운 출구를 찾아요.'},
  },
  wind: {
    classic: {name: '기본 항로', description: '익숙한 바람길을 타고 고향으로 향해요.'},
    'remix-a': {name: '구름 순례길', description: '구름다리와 유적을 새로운 순서로 건너요.'},
    'remix-b': {name: '순풍 우회길', description: '달라진 바람길과 끊어진 다리를 살펴봐요.'},
  },
  sea: {
    classic: {name: '기본 항로', description: '노래가 들리는 바다를 익숙한 길로 건너요.'},
    'remix-a': {name: '절벽 신전길', description: '세이렌 석상 사이를 새로운 순서로 지나요.'},
    'remix-b': {name: '밀랍 항로', description: '귀를 막고 달라진 파도의 위험을 살펴봐요.'},
  },
};
// Six authored 3,200px encounter sections. Intro [0,3200) and harbor
// [22400,24000] remain intact. Orders are fixed and verified, never random.
export const SECTION_START = 3200,
  SECTION_WIDTH = 3200;
export const COURSE_ORDERS: Record<StageId, Record<Exclude<VariantId, 'classic'>, readonly number[]>> = {
  beach: {'remix-a': [2, 0, 1, 4, 3, 5], 'remix-b': [1, 0, 2, 3, 5, 4]},
  cave: {'remix-a': [3, 0, 1, 2, 4, 5], 'remix-b': [4, 5, 0, 1, 2, 3]},
  wind: {'remix-a': [3, 4, 5, 0, 1, 2], 'remix-b': [5, 0, 1, 2, 3, 4]},
  sea: {'remix-a': [1, 2, 0, 4, 5, 3], 'remix-b': [3, 0, 2, 1, 5, 4]},
};
export function rearrangeCourse(
  stage: StageId,
  variant: Exclude<VariantId, 'classic'>,
  order: readonly number[],
): Course {
  if (order.length !== 6 || new Set(order).size !== 6 || order.some(n => !Number.isInteger(n) || n < 0 || n > 5))
    throw Error('Invalid authored section order');
  const source = COURSES[stage],
    out = structuredClone(source);
  const move = (x: number) => {
    if (x < SECTION_START || x >= 22400) return x;
    const section = Math.floor((x - SECTION_START) / SECTION_WIDTH);
    return x + (order.indexOf(section) - section) * SECTION_WIDTH;
  };
  out.variant = variant;
  out.routeName = VARIANT_LABELS[stage][variant].name;
  for (const objects of [out.obstacles, out.enemies, out.platforms, out.winds, out.gaps])
    for (const o of objects) o.x = move(o.x);
  for (const i of out.items) {
    i.x = move(i.x);
    if (i.checkpoint !== undefined) i.checkpoint = move(i.checkpoint);
  }
  out.gaps.sort((a, b) => a.x - b.x);
  out.safe = safePoints(out, [0, ...out.safe.map(move)]);
  const plan = structuredClone(ADVENTURE_PLANS[stage]),
    branch = plan.branch,
    branchDelta = move(branch.start) - branch.start;
  branch.start += branchDelta;
  branch.end += branchDelta;
  plan.stories.forEach(s => {
    s.x = move(s.x);
  });
  const anchor = stage === 'beach' ? 8500 : stage === 'cave' ? 13400 : stage === 'sea' ? 13300 : 19800,
    delta = move(anchor) - anchor;
  plan.highlight.start = Math.max(0, plan.highlight.start + delta);
  plan.highlight.end = Math.min(C.length, plan.highlight.end + delta);
  out.adventure = plan;
  return out;
}
export const VARIANT_COURSES = Object.fromEntries(
  STAGES.map(stage => [
    stage,
    {
      classic: COURSES[stage],
      'remix-a': rearrangeCourse(stage, 'remix-a', COURSE_ORDERS[stage]['remix-a']),
      'remix-b': rearrangeCourse(stage, 'remix-b', COURSE_ORDERS[stage]['remix-b']),
    },
  ]),
) as Record<StageId, Record<VariantId, Course>>;
export const getCourse = (stage: StageId, variant: VariantId = 'classic') => VARIANT_COURSES[stage][variant];
export {VARIANTS};
