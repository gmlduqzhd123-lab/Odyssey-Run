import {isCeiling, type StageId} from './courses';
import {ADVENTURE_PLANS} from './adventure';
import {ENEMY_TYPES} from './enemies';
import {getCourse} from './variants';
import type {VariantId} from './course-ids';
// Compact authored input fixtures, also used for browser keyboard verification.
export function routeInputs(
  id: StageId,
  path: 'lower' | 'upper' = 'lower',
  stories = false,
  variant: VariantId = 'classic',
  course = getCourse(id, variant),
  // Distances before (and after) each thing scale with running speed: the same reaction time.
  lead = 1,
) {
  const at = (x: number, d: number) => x + d * lead;
  const c = course,
    adventure = c.adventure ?? ADVENTURE_PLANS[id];
  const jumps: number[] = [];
  c.obstacles.forEach(o => {
    if (isCeiling(o.kind)) return;
    if (o.kind === 'pillar') {
      jumps.push(at(o.x, -140), at(o.x, -45));
    } else jumps.push(at(o.x, -110));
  });
  c.gaps.forEach(g => jumps.push(at(g.x, -95), at(g.x, 10)));
  const map = c.items.find(i => i.id === `${id}-map-2`);
  if (map) jumps.push(at(map.x, -180), at(map.x, -90));
  const slides = c.obstacles.filter(o => isCeiling(o.kind)).map(o => ({start: at(o.x, -70), end: o.x + o.w + 70}));
  c.enemies.forEach(e => {
    if (
      e.bait ||
      (path === 'upper' && e.kind === 'harpy' && e.x > adventure.branch.start && e.x < adventure.branch.end)
    )
      return;
    const spec = ENEMY_TYPES[e.kind];
    if (e.kind === 'harpy' || e.kind === 'shade') slides.push({start: at(e.x, -spec.lead), end: e.x + 160});
    else {
      // Land just before the wind island's low constellation star; its transparent
      // margin no longer counts as contact. Course and movement remain unchanged.
      jumps.push(at(e.x, -(e.id === 'wind-enemy-ground-1' && lead === 1 ? 140 : spec.lead)));
      if (e.kind === 'cyclops') jumps.push(at(e.x, -80));
    }
  });
  if (path === 'upper') jumps.push(at(adventure.branch.start, -100));
  if (stories) {
    const story = adventure.stories[1];
    slides.push({start: story.x - 80, end: story.x + 80});
  }
  return {jumps: jumps.sort((a, b) => a - b), slides: slides.sort((a, b) => a.start - b.start)};
}
