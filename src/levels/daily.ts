import {VARIANTS, type VariantId} from './course-ids';
import type {RunResult} from '../storage/save';
export type DailyRule = 'no-shield' | 'stars' | 'clean';
export const koreanDay = (now = new Date()) => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
export function dailySpec(date = koreanDay()) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000),
    rules: DailyRule[] = ['no-shield', 'stars', 'clean'],
    rule = rules[((day % 3) + 3) % 3],
    variant: VariantId = VARIANTS[((Math.floor(day / 3) % 3) + 3) % 3];
  return {
    date,
    stage: 'beach' as const,
    variant,
    rule,
    name: rule === 'no-shield' ? '방패 없이 귀환' : rule === 'stars' ? '별빛 70개와 귀환' : '상처 없이 귀환',
    description:
      rule === 'no-shield'
        ? '방패 효과 없이 끝까지 달려요. 다른 아이템은 사용할 수 있어요.'
        : rule === 'stars'
          ? '완주하면서 별빛을 70개 이상 모아요.'
          : '완주할 때까지 HP 손실 0회를 지켜요. 사과 회복으로 피해 이력을 지울 수 없어요.',
  };
}
export type DailySpec = ReturnType<typeof dailySpec>;
export function dailyPassed(spec: DailySpec, r: RunResult) {
  return r.complete && (spec.rule === 'stars' ? r.stars >= 70 : spec.rule === 'clean' ? r.hpLoss === 0 : true);
}
