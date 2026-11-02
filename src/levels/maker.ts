import {C} from '../config';
import {POUNDER, SPIKES, safePoints, type Course, type StageId, COURSES} from './courses';
import type {EnemyPlacement} from './enemies';
import {routeInputs} from './route-inputs';
import {Runner} from '../player/runner';
// Courses students build from blocks and share by QR. Each block is 1,000px with a short star
// trail before its challenge; a course is checked by running it with the authored route inputs,
// so only a course that can be finished without losing a heart can be shared.
export const MAKER_SLOTS = 10;
export const BLOCK_W = 1000;
const INTRO = 1200,
  OUTRO = 1300;
export const makerLength = (slots = MAKER_SLOTS) => INTRO + slots * BLOCK_W + OUTRO;
export const BLOCKS = {
  f: {name: '평지', hint: '숨 고르기'},
  c: {name: '나무 상자', hint: '닿아도 안전'},
  g: {name: '낮은 문', hint: '숙이기'},
  p: {name: '낭떠러지', hint: '점프'},
  s: {name: '가시 함정', hint: '점프'},
  o: {name: '내려치는 기둥', hint: '숙이기'},
  k: {name: '거대 집게게', hint: '점프'},
  h: {name: '하르피아', hint: '숙이기'},
  b: {name: '무너지는 다리', hint: '점프로 건너기'},
  w: {name: '시소 다리', hint: '걸어서 건너기'},
  l: {name: '오르내리는 발판', hint: '타이밍'},
  v: {name: '바람길', hint: '바람 타고 점프'},
} as const;
export type BlockId = keyof typeof BLOCKS;
export const BLOCK_IDS = Object.keys(BLOCKS) as BlockId[];
export const isBlocks = (s: string) => s.length === MAKER_SLOTS && [...s].every(c => BLOCK_IDS.includes(c as BlockId));
export function buildCustom(stage: StageId, blocks: string, title = '나만의 코스'): Course {
  if (!isBlocks(blocks)) throw Error('blocks');
  const length = makerLength(),
    c: Course = {
      ...COURSES[stage],
      name: title,
      routeName: '나만의 코스',
      length,
      gaps: [],
      obstacles: [],
      platforms: [],
      winds: [],
      safe: [],
      items: [],
      enemies: [],
      adventure: {
        branch: {id: 'custom-none', start: length * 10, end: length * 10 + 1, y: 330},
        constellations: [],
        stories: [],
        highlight: {id: 'custom', start: length * 10, end: length * 10, name: '', hint: ''},
      },
    };
  delete c.spells;
  const enemies: EnemyPlacement[] = [];
  [...blocks].forEach((b, i) => {
    const x = INTRO + i * BLOCK_W,
      mid = x + 500,
      id = `custom-${i}`;
    for (let j = 0; j < 3; j++) c.items.push({id: `${id}-star-${j}`, kind: 'star', x: x + 150 + j * 65, y: 405});
    const gap = (w: number) => c.gaps.push({x: mid, w});
    if (b === 'c') c.obstacles.push({id, kind: 'crate', role: 'structure', x: mid, y: C.ground - 48, w: 70, h: 48});
    if (b === 'g') c.obstacles.push({id, kind: 'gate', role: 'structure', x: mid - 50, y: 279, w: 160, h: 125});
    if (b === 's') c.obstacles.push({id, kind: 'spikes', role: 'hazard', x: mid, y: C.ground - SPIKES.h, ...SPIKES});
    if (b === 'o')
      c.obstacles.push({
        id,
        kind: 'pounder',
        role: 'hazard',
        x: mid - 20,
        y: POUNDER.bottom - POUNDER.h,
        w: POUNDER.w,
        h: POUNDER.h,
      });
    if (b === 'k') enemies.push({id, kind: 'crab', x: mid});
    if (b === 'h') enemies.push({id, kind: 'harpy', x: mid});
    if (b === 'p') gap(150);
    if (b === 'b') {
      gap(160);
      c.platforms.push({id, x: mid, y: C.ground, w: 160, crumble: true});
    }
    if (b === 'w') {
      gap(170);
      c.platforms.push({id, x: mid - 20, y: C.ground, w: 210, seesaw: true});
    }
    if (b === 'l') {
      gap(150);
      c.platforms.push({id, x: mid + 8, y: C.ground, w: 134, lift: true});
    }
    if (b === 'v') {
      gap(210);
      c.winds.push({x: mid - 300, y: 60, w: 740, h: 400});
    }
    // Stars arc over every drop, so the jump has a trail to follow.
    if ('pblv'.includes(b))
      for (let j = 0; j < 3; j++)
        c.items.push({id: `${id}-arc-${j}`, kind: 'star', x: mid + 10 + j * 60, y: 300 - (j === 1 ? 30 : 0)});
  });
  c.enemies = enemies;
  c.safe = safePoints(c, [0, ...Array.from({length: MAKER_SLOTS + 1}, (_, i) => INTRO + i * BLOCK_W - 100)]);
  return c;
}
// Runs the course with the same inputs the island checks use. Damage or a fall means a block
// placement a classmate could not reasonably clear.
export function checkCustom(course: Course) {
  const r = new Runner(course.id, 'maps', 'classic', course),
    p = routeInputs(course.id, 'lower', false, 'classic', course);
  r.state = 'playing';
  let i = 0;
  while (r.state === 'playing' && r.time < 120) {
    while (i < p.jumps.length && r.x >= p.jumps[i]) {
      r.jump();
      i++;
    }
    r.slide(p.slides.some(s => r.x >= s.start && r.x < s.end));
    r.tick();
  }
  const first = r.damageLog[0],
    state: string = r.state;
  return {
    ok: state === 'success' && r.hpLoss === 0,
    slot: first ? Math.max(0, Math.min(MAKER_SLOTS - 1, Math.floor((first.x - INTRO) / BLOCK_W))) : -1,
    kind: first?.kind ?? null,
    stars: r.stars,
  };
}
// A friendly random course that passes the check (retries a few times, then falls back to flat).
export function randomBlocks(random: () => number = Math.random, stage: StageId = 'beach') {
  for (let tries = 0; tries < 40; tries++) {
    const s = Array.from({length: MAKER_SLOTS}, () => BLOCK_IDS[Math.floor(random() * BLOCK_IDS.length)]).join('');
    if (checkCustom(buildCustom(stage, s)).ok) return s;
  }
  return 'f'.repeat(MAKER_SLOTS);
}
