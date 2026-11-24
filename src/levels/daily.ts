import {VARIANTS, type VariantId} from './course-ids';
import type {RunResult} from '../storage/save';
export type DailyRule = 'no-shield' | 'stars' | 'clean' | 'magnet' | 'lantern';
// The oracle's days: a gift held for the whole run. They change what is picked up or kept away,
// never how the hero runs or jumps, so every course stays the one the class knows.
export const ORACLE_RULES: readonly DailyRule[] = ['magnet', 'lantern'];
export const koreanDay = (now = new Date()) => new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
export function dailySpec(date = koreanDay()) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000),
    rules: DailyRule[] = ['no-shield', 'stars', 'clean', 'magnet', 'lantern'],
    rule = rules[((day % rules.length) + rules.length) % rules.length],
    variant: VariantId = VARIANTS[((Math.floor(day / 3) % 3) + 3) % 3];
  return {
    date,
    stage: 'beach' as const,
    variant,
    rule,
    name:
      rule === 'no-shield'
        ? '방패 없이 귀환'
        : rule === 'stars'
          ? '별빛 70개와 귀환'
          : rule === 'clean'
            ? '상처 없이 귀환'
            : rule === 'magnet'
              ? '신탁: 헤르메스의 자석'
              : '신탁: 아폴론의 등불',
    description:
      rule === 'no-shield'
        ? '방패 효과 없이 끝까지 달려요. 다른 아이템은 사용할 수 있어요.'
        : rule === 'stars'
          ? '완주하면서 별빛을 70개 이상 모아요.'
          : rule === 'clean'
            ? '완주할 때까지 HP 손실 0회를 지켜요. 사과 회복으로 피해 이력을 지울 수 없어요.'
            : rule === 'magnet'
              ? '오늘의 신탁! 처음부터 끝까지 별빛 자석이 켜져 있어요. 완주하면서 별빛을 80개 이상 모아요.'
              : '오늘의 신탁! 처음부터 끝까지 등불이 켜져 공중 위협을 막아 줘요. 상처 없이 완주해 보세요.',
  };
}
export type DailySpec = ReturnType<typeof dailySpec>;
export function dailyPassed(spec: DailySpec, r: RunResult) {
  return (
    r.complete &&
    (spec.rule === 'stars'
      ? r.stars >= 70
      : spec.rule === 'magnet'
        ? r.stars >= 80
        : spec.rule === 'clean' || spec.rule === 'lantern'
          ? r.hpLoss === 0
          : true)
  );
}
