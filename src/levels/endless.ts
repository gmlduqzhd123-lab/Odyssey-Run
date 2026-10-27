import {COURSES, safePoints, type Course, type StageId} from './courses';
import {SECTION_START, SECTION_WIDTH} from './variants';
// Endless voyages chain the island's six authored 3,200px sections in a seeded order.
// Maps and story discoveries stay on the normal courses; the run ends when HP runs out.
export const ENDLESS_SECTIONS = 60;
const SECTIONS = 6;
export const endlessLength = (sections = ENDLESS_SECTIONS) => SECTION_START + sections * SECTION_WIDTH + 800;
export function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Each block of six is a shuffle of all sections, never repeating one across a block edge.
export function endlessOrder(seed: string, sections = ENDLESS_SECTIONS) {
  const random = seeded(seed),
    out: number[] = [];
  while (out.length < sections) {
    const block = [...Array(SECTIONS).keys()];
    for (let i = block.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [block[i], block[j]] = [block[j], block[i]];
    }
    if (block[0] === out.at(-1)) block.push(block.shift()!);
    out.push(...block);
  }
  return out.slice(0, sections);
}
export function buildEndless(stage: StageId, seed: string, sections = ENDLESS_SECTIONS): Course {
  const source = COURSES[stage],
    order = endlessOrder(seed, sections),
    length = endlessLength(sections);
  const section = (x: number) => Math.floor((x - SECTION_START) / SECTION_WIDTH);
  // Intro objects keep their place; every section copy gets a unique id suffix.
  function place<T extends {x: number; id?: string}>(list: T[], keep: (o: T) => boolean = () => true) {
    const out: T[] = list.filter(o => o.x < SECTION_START && keep(o)).map(o => structuredClone(o));
    order.forEach((k, i) => {
      for (const o of list) {
        if (o.x < SECTION_START || section(o.x) !== k || o.x >= SECTION_START + SECTIONS * SECTION_WIDTH || !keep(o))
          continue;
        const copy = structuredClone(o) as T & {checkpoint?: number},
          delta = (i - k) * SECTION_WIDTH;
        copy.x = o.x + delta;
        if (copy.checkpoint !== undefined) copy.checkpoint += delta;
        if (copy.id !== undefined) copy.id = `${o.id}~e${i}`;
        out.push(copy);
      }
    });
    return out.sort((a, b) => a.x - b.x);
  }
  const items = place(source.items, i => i.kind !== 'map');
  const course: Course = {
    ...source,
    mode: 'endless',
    length,
    routeName: '끝없는 항해',
    gaps: place(source.gaps),
    obstacles: place(source.obstacles),
    platforms: place(source.platforms),
    winds: place(source.winds),
    enemies: place(source.enemies),
    items,
    safe: [],
    adventure: {
      branch: {id: 'endless-none', start: length * 10, end: length * 10 + 1, y: 330},
      constellations: [],
      stories: [],
      highlight: {id: 'endless', start: length * 10, end: length * 10, name: '', hint: ''},
    },
  };
  course.safe = safePoints(course, [0, ...order.map((_, i) => SECTION_START + i * SECTION_WIDTH)]);
  return course;
}
// Distance is the headline: a section counts once the hero reaches its end.
export const sectionsPassed = (distance: number) => Math.max(0, Math.floor((distance - SECTION_START) / SECTION_WIDTH));
