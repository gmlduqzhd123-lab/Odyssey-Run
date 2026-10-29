import test from 'node:test';
import assert from 'node:assert/strict';
import {Controls, padState} from '../src/input/controls';
import {C, MAX_SCORE} from '../src/config';
import {COURSES, STAGES} from '../src/levels/courses';
import {Runner} from '../src/player/runner';
import {score, rating} from '../src/systems/score';
import {emptySave, validateSave, mergeResult, SaveStore, SAVE_KEY, BACKUP_KEY, unlocked} from '../src/storage/save';
const playing = () => {
  const r = new Runner('beach');
  r.state = 'playing';
  return r;
};
const step = (r: Runner, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / C.step); i++) r.tick();
};
const result = {
  stage: 'beach' as const,
  complete: true,
  score: 3600,
  rating: 2,
  stars: 70,
  maps: ['beach-map-1'],
  hpLoss: 1,
  distance: 24000,
};
test('A13 score, clamp, failure and rating use damage history', () => {
  assert.equal(MAX_SCORE, 4200);
  assert.equal(score(24000, 100, 3, true), 4200);
  assert.equal(score(25000, 100, 3, false), 3700);
  assert.equal(rating(true, 70, 1), 2);
  assert.equal(rating(true, 69, 0), 2);
  assert.equal(rating(false, 100, 0), 0);
});
test('A02/A03 edge-triggered jump and maximum two jumps', () => {
  const r = playing();
  r.jump();
  r.tick();
  assert.equal(r.jumps, 1);
  step(r, 0.15);
  assert.equal(r.jumps, 1);
  r.jump();
  r.tick();
  assert.equal(r.jumps, 2);
  r.jump();
  r.tick();
  assert.equal(r.jumps, 2);
  assert.ok(r.vy > C.jump);
});
test('coyote time and air-only jump after grace expires', () => {
  const r = playing();
  r.x = 8508;
  r.grounded = false;
  r.coyote = 0.06;
  r.jump();
  r.tick();
  assert.equal(r.jumps, 1);
  const late = playing();
  late.x = 8550;
  late.grounded = false;
  late.coyote = 0;
  late.jump();
  late.tick();
  assert.equal(late.jumps, 2);
});
test('100ms landing buffer triggers and expired input does not', () => {
  const r = playing();
  r.y = 432;
  r.vy = 200;
  r.grounded = false;
  r.jumps = 2;
  r.jump();
  step(r, 0.05);
  assert.equal(r.jumps, 1);
  assert.ok(r.vy < 0);
  const late = playing();
  late.y = 100;
  late.grounded = false;
  late.jumps = 2;
  late.jump();
  step(late, 0.15);
  assert.equal(late.buffer, 0);
});
test('A04 slide stays below ceiling; blocked jump spends no jump', () => {
  const r = playing();
  r.x = 6420;
  r.slide(true);
  r.tick();
  assert.ok(r.sliding);
  r.slide(false);
  r.jump();
  r.tick();
  assert.ok(r.sliding);
  assert.equal(r.jumps, 0);
  assert.equal(r.y, 440);
  r.x = 6600;
  r.tick();
  assert.equal(r.sliding, false);
});
test('jump beats slide when space permits, air slide does not dive', () => {
  const r = playing();
  r.slide(true);
  r.jump();
  r.tick();
  assert.ok(!r.sliding);
  assert.ok(r.vy < 0);
  const v = r.vy;
  r.tick();
  assert.ok(r.vy - v < 31);
});
test('A06/A07 shield, invincibility, falling ignores both', () => {
  const r = playing();
  r.shield = true;
  r.hurt();
  assert.equal(r.hp, 3);
  assert.equal(r.shield, false);
  r.hurt();
  assert.equal(r.hp, 3);
  r.shield = true;
  r.hurt(true);
  assert.equal(r.hp, 2);
  assert.equal(r.hpLoss, 1);
  assert.equal(r.shield, true);
});
test('A08 fall returns once to safe location with max distance and IDs preserved', () => {
  const r = playing();
  r.x = 8580;
  r.safeX = 6900;
  r.maxDistance = 9000;
  r.y = 660;
  r.grounded = false;
  r.shield = true;
  r.collect(r.course.items[0]);
  r.tick();
  assert.equal(r.hp, 2);
  assert.equal(r.x, 6900);
  assert.equal(r.maxDistance, 9000);
  assert.equal(r.stars, 1);
  r.collect(r.course.items[0]);
  assert.equal(r.stars, 1);
  r.tick();
  assert.equal(r.hp, 2);
});
test('A09 vertical wind and wings cap, timers and jumps are independent', () => {
  const r = new Runner('wind');
  r.state = 'playing';
  r.x = 1300;
  r.y = 250;
  r.vy = 500;
  r.grounded = false;
  r.jumps = 2;
  r.wings = 6;
  r.tick();
  assert.ok(r.vy <= 220);
  step(r, 0.3);
  assert.equal(r.jumps, 2);
  assert.ok(Math.abs(r.x - (1300 + 320 * (19 / 60))) < 1e-8);
  r.x = 5000;
  r.wings = 0;
  r.vy = 200;
  r.tick();
  assert.equal(r.vy, 230);
});
test('A10 magnet only attracts stars and not maps', () => {
  const r = playing();
  const star = r.course.items[0];
  r.x = star.x - 130;
  r.magnet = 6;
  r.tick();
  assert.ok(r.collected.has(star.id));
  const map = r.course.items.find(i => i.kind === 'map')!;
  r.x = map.x - 130;
  r.tick();
  assert.ok(!r.maps.has(map.id));
});
test('A11 effect refreshes instead of stacking, pause freezes all game time', () => {
  const r = playing();
  const wings = r.course.items.find(i => i.kind === 'wings')!;
  r.wings = 3;
  r.collect(wings);
  assert.equal(r.wings, 6);
  r.state = 'paused';
  const x = r.x;
  step(r, 10);
  assert.equal(r.wings, 6);
  assert.equal(r.x, x);
});
test('A12 fatal obstacle collision at finish takes priority; result is stable', () => {
  const r = playing();
  const obstacle = {
    id: 'test-finish-rock',
    kind: 'rock' as const,
    role: 'hazard' as const,
    x: 23980,
    y: 392,
    w: 90,
    h: 48,
  };
  r.course.obstacles.push(obstacle);
  try {
    r.x = 23999;
    r.hp = 1;
    r.tick();
    assert.equal(r.state, 'failure');
    assert.equal(r.result().complete, false);
    assert.equal(r.result().score, 2400);
    assert.equal(r.result(), r.result());
  } finally {
    r.course.obstacles.pop();
  }
});
test('arrival uses current location, and fall recovery never counts as completion', () => {
  const r = playing();
  r.maxDistance = 24000;
  r.x = 100;
  r.tick();
  assert.equal(r.state, 'playing');
  r.x = 24000;
  r.recovering = 1;
  r.tick();
  assert.equal(r.state, 'playing');
  r.recovering = 0;
  r.y = 660;
  r.grounded = false;
  r.hp = 2;
  r.tick();
  assert.equal(r.state, 'playing');
  assert.equal(r.hp, 1);
  assert.equal(r.x, 23000);
  assert.equal(r.maxDistance, 24000);
});
test('A14 apple healing does not erase HP loss', () => {
  const r = playing();
  r.hurt();
  r.collect(r.course.items.find(i => i.kind === 'apple')!);
  assert.equal(r.hp, 3);
  assert.equal(r.hpLoss, 1);
  assert.equal(rating(true, 100, r.hpLoss), 2);
});
test('A15 merge is idempotent, ratings are maxima from one run', () => {
  const a = mergeResult(emptySave(), result);
  assert.deepEqual(mergeResult(a, result).stages, a.stages);
  const b = mergeResult(a, {...result, score: 3500, rating: 2, stars: 60, hpLoss: 0, maps: ['beach-map-2']});
  assert.equal(b.stages.beach.bestRating, 2);
  assert.equal(b.stages.beach.bestStars, 70);
  assert.equal(b.stages.beach.bestScore, 3600);
  assert.equal(b.stages.beach.maps.length, 2);
  assert.ok(unlocked(b, 'cave'));
  assert.ok(!unlocked(b, 'wind'));
});
test('A23 validation rejects missing, non-finite, excess, duplicate, invalid IDs, progress', () => {
  const good = mergeResult(emptySave(), result);
  assert.deepEqual(validateSave(good), good);
  for (const value of [-1, Infinity, NaN, 4201, 1.5]) {
    const s = structuredClone(good);
    s.stages.beach.bestScore = value;
    assert.throws(() => validateSave(s));
  }
  const variants = [
    {...good, schemaVersion: 9},
    {...good, settings: {}},
    {...good, lastStage: 'wind'},
  ];
  for (const v of variants) assert.throws(() => validateSave(v));
  for (const maps of [['beach-map-1', 'beach-map-1'], ['wind-map-1']]) {
    const s = structuredClone(good);
    s.stages.beach.maps = maps;
    assert.throws(() => validateSave(s));
  }
  const s = emptySave();
  s.stages.cave = {...good.stages.beach, maps: []};
  assert.throws(() => validateSave(s));
});
class Memory {
  values = new Map<string, string>();
  fail = false;
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.fail) throw Error();
    this.values.set(k, v);
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
}
test('A20/A21 corrupt original preserved, memory play continues, blocked saves never overwrite', () => {
  const m = new Memory();
  m.setItem(SAVE_KEY, '{broken');
  const s = new SaveStore(m);
  assert.ok(s.blocked);
  s.data = mergeResult(s.data, result);
  assert.ok(!s.persist());
  assert.equal(m.getItem(SAVE_KEY), '{broken');
  assert.equal(s.data.stages.beach.bestScore, 3600);
});
test('empty persisted string is corrupt data and stays intact during memory play', () => {
  const m = new Memory();
  m.setItem(SAVE_KEY, '');
  m.setItem('other-app', 'keep');
  const s = new SaveStore(m);
  assert.ok(s.blocked);
  s.data = mergeResult(s.data, result);
  assert.equal(s.persist(), false);
  assert.equal(m.getItem(SAVE_KEY), '');
  assert.equal(m.getItem('other-app'), 'keep');
  assert.equal(s.data.stages.beach.bestScore, 3600);
  const missing = new SaveStore(new Memory());
  assert.equal(missing.blocked, false);
});
test('A22 replace backs up exact original, reset only touches this app', () => {
  const m = new Memory(),
    s = new SaveStore(m);
  s.persist();
  const original = m.getItem(SAVE_KEY);
  const good = mergeResult(emptySave(), result);
  assert.ok(s.replace(good));
  assert.equal(m.getItem(BACKUP_KEY), original);
  assert.deepEqual(new SaveStore(m).data, good);
  m.setItem('other-app', 'keep');
  assert.ok(s.reset());
  assert.equal(m.getItem('other-app'), 'keep');
  assert.equal(m.getItem(BACKUP_KEY), null);
});
test('failed replacement preserves persisted and memory records', () => {
  const m = new Memory(),
    s = new SaveStore(m);
  s.persist();
  const previous = m.getItem(SAVE_KEY);
  m.fail = true;
  assert.ok(!s.replace(mergeResult(emptySave(), result)));
  assert.equal(m.getItem(SAVE_KEY), previous);
  assert.equal(s.data.stages.beach.complete, false);
});
test('fixed courses have 100 unique stars, three unique maps, safe checkpoints and all item types', () => {
  for (const id of STAGES) {
    const c = COURSES[id];
    assert.equal(c.items.filter(i => i.kind === 'star').length, 100);
    assert.equal(c.items.filter(i => i.kind === 'map').length, 3);
    assert.equal(new Set(c.items.map(i => i.id)).size, c.items.length);
    assert.ok(['shield', 'wings', 'magnet', 'apple', 'map'].every(k => c.items.some(i => i.kind === k)));
    assert.equal(c.safe[0], 0);
    for (const x of c.safe) {
      assert.ok(!c.gaps.some(g => x > g.x && x < g.x + g.w));
      assert.ok(!c.obstacles.some(o => o.x >= x && o.x < x + 400));
    }
  }
});
test('A28 fixed accumulator gives same distance and apex at 30/60/120 Hz', () => {
  const outcomes = [30, 60, 120].map(hz => {
    const r = playing();
    let accumulator = 0,
      apex = 440;
    r.jump();
    for (let f = 0; f < hz * 2; f++) {
      accumulator += 1 / hz;
      while (accumulator + 1e-10 >= C.step) {
        r.tick();
        accumulator -= C.step;
        apex = Math.min(apex, r.y);
      }
    }
    return {x: r.x, apex};
  });
  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.deepEqual(outcomes[1], outcomes[2]);
});

test('A17 three fixed routes and all maps are reachable without power-up items', async () => {
  const {routeInputs} = await import('../scripts/check-routes');
  for (const id of STAGES) {
    const r = new Runner(id);
    r.state = 'playing';
    const collect = r.collect.bind(r);
    r.collect = item => {
      if (item.kind === 'star' || item.kind === 'map') collect(item);
    };
    const input = routeInputs(id);
    let index = 0;
    while (r.state === 'playing' && r.time < 95) {
      while (index < input.jumps.length && r.x >= input.jumps[index]) {
        r.jump();
        index++;
      }
      r.slide(input.slides.some(s => r.x >= s.start && r.x < s.end));
      r.tick();
    }
    assert.equal(r.state, 'success', id);
    assert.equal(r.maps.size, 3, id);
    assert.equal(r.hpLoss, 0, id);
    assert.equal(r.shield, false);
  }
});

test('A02 keyboard repeat, held keys and released inputs share one action path', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const target = new EventTarget();
  Object.defineProperty(globalThis, 'window', {value: target, configurable: true});
  let jumps = 0,
    sliding = false;
  const controls = new Controls({
    jump: () => jumps++,
    slide: h => {
      sliding = h;
    },
    pause: () => {},
    active: () => true,
  });
  const key = (type: string, code: string, repeat = false) =>
    target.dispatchEvent(Object.assign(new Event(type, {cancelable: true}), {code, repeat}));
  try {
    key('keydown', 'Space');
    key('keydown', 'Space', true);
    key('keydown', 'Space');
    assert.equal(jumps, 1);
    key('keyup', 'Space');
    key('keydown', 'Space');
    assert.equal(jumps, 2);
    key('keydown', 'ArrowDown');
    assert.ok(sliding);
    controls.clear();
    assert.equal(sliding, false);
    key('keydown', 'Space');
    assert.equal(jumps, 3);
  } finally {
    controls.destroy();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
test('pause shortcut works during countdown without enabling movement or repeating', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window'),
    target = new EventTarget();
  Object.defineProperty(globalThis, 'window', {value: target, configurable: true});
  let jumps = 0,
    pauses = 0,
    canPause = true;
  const controls = new Controls({
    jump: () => jumps++,
    slide: () => {},
    pause: () => pauses++,
    active: () => false,
    pauseActive: () => canPause,
  });
  const key = (code: string, repeat = false) =>
    target.dispatchEvent(Object.assign(new Event('keydown', {cancelable: true}), {code, repeat}));
  try {
    key('Space');
    key('Escape');
    key('Escape', true);
    key('Escape');
    assert.equal(jumps, 0);
    assert.equal(pauses, 1);
    canPause = false;
    key('KeyP');
    assert.equal(pauses, 1);
  } finally {
    controls.destroy();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('expansion leaves score/save v1 compatible; six monsters and all eight items have real placements', () => {
  const kinds = new Set<string>();
  for (const id of STAGES) {
    const c = COURSES[id];
    assert.equal(c.enemies.length, id === 'cave' ? 9 : 7);
    assert.equal(c.items.length, 117);
    for (const e of c.enemies) {
      kinds.add(e.kind);
      assert.ok(!c.obstacles.some(o => Math.abs(o.x - e.x) < 200));
      assert.ok(!c.gaps.some(g => e.x > g.x - 250 && e.x < g.x + g.w + 250));
    }
    for (const kind of ['trident', 'lantern', 'compass']) assert.equal(c.items.filter(i => i.kind === kind).length, 2);
    for (const i of c.items.filter(i => i.kind === 'compass')) {
      assert.ok(i.checkpoint !== undefined && i.checkpoint < i.x);
      assert.ok(!c.obstacles.some(o => o.x >= i.checkpoint! && o.x < i.checkpoint! + 400));
      assert.ok(!c.enemies.some(e => e.x >= i.checkpoint! && e.x < i.checkpoint! + 400));
    }
  }
  assert.equal(kinds.size, 6);
  const old = mergeResult(emptySave(), result);
  assert.deepEqual(validateSave(old), old);
  assert.equal(old.schemaVersion, 1);
  assert.equal(MAX_SCORE, 4200);
});
test('trident holds one charge, defeats a monster once and adds no score', () => {
  const r = playing(),
    powers = r.course.items.filter(i => i.kind === 'trident');
  r.collect(powers[0]);
  r.collect(powers[1]);
  assert.equal(r.trident, true);
  assert.equal(r.points, 0);
  r.x = 7300;
  r.tick();
  assert.equal(r.trident, false);
  assert.equal(r.defeated.size, 1);
  assert.equal(r.hpLoss, 0);
  const id = [...r.defeated][0];
  r.x = 7300;
  r.tick();
  assert.equal(r.defeated.size, 1);
  assert.ok(r.enemyStates.find(e => e.id === id)!.defeated);
  assert.equal(new Runner('beach').defeated.size, 0);
});
test('lantern refreshes to six seconds, freezes paused, and only repels air threats and thrown rocks', () => {
  const r = playing(),
    p = r.course.items.filter(i => i.kind === 'lantern');
  r.collect(p[0]);
  r.lantern = 2;
  r.collect(p[1]);
  assert.equal(r.lantern, 6);
  r.state = 'paused';
  step(r, 10);
  assert.equal(r.lantern, 6);
  r.state = 'playing';
  r.x = 5700;
  r.tick();
  assert.equal(r.hpLoss, 0);
  assert.ok(r.enemyStates.find(e => e.kind === 'harpy')!.repelled);
  r.x = 7400;
  r.tick();
  assert.equal(r.hpLoss, 1);
  assert.equal(r.lantern > 0, true);
  const cave = new Runner('cave');
  cave.state = 'playing';
  cave.x = 12030;
  cave.lantern = 6;
  cave.tick();
  assert.equal(cave.hpLoss, 0);
  assert.ok(!cave.enemyStates.find(e => e.kind === 'cyclops')!.projectile.active);
  cave.x = 12200;
  cave.tick();
  assert.equal(cave.hpLoss, 1);
});
test('compass advances only to a passed safe point and falling keeps collection and score', () => {
  const r = playing(),
    p = r.course.items.find(i => i.kind === 'compass')!;
  r.x = p.x;
  r.maxDistance = p.x;
  r.collect(p);
  assert.equal(r.safeX, p.checkpoint);
  const scoreBefore = r.points;
  r.x = 8580;
  r.y = 660;
  r.grounded = false;
  r.shield = true;
  r.lantern = 6;
  r.tick();
  assert.equal(r.x, p.checkpoint);
  assert.equal(r.hpLoss, 1);
  assert.ok(r.collected.has(p.id));
  assert.ok(r.points >= scoreBefore);
  const fresh = playing();
  fresh.collect(p);
  assert.equal(fresh.safeX, 0);
});
test('six enemy behaviors give warning before activation and use game-time motion', async () => {
  const {createEnemyState, updateEnemyState, ENEMY_TYPES} = await import('../src/levels/enemies');
  for (const kind of Object.keys(ENEMY_TYPES) as (keyof typeof ENEMY_TYPES)[]) {
    const p = {id: kind, kind, x: 5000},
      s = createEnemyState(p);
    updateEnemyState(s, p, 4300, 0, false, false);
    assert.equal(s.warning, true, kind);
    assert.ok((700 - ENEMY_TYPES[kind].lead) / C.speed >= 1, kind);
    const x = s.x;
    updateEnemyState(s, p, 4950, 2, false, false);
    if (kind === 'crab' || kind === 'harpy' || kind === 'stone' || kind === 'shade') assert.notEqual(s.x, x, kind);
    if (kind === 'cyclops') assert.ok(s.projectile.active);
    if (kind === 'scylla') assert.equal(s.reveal, 1);
    updateEnemyState(s, p, 4950, 2, true, false);
    assert.equal(s.repelled, kind === 'harpy' || kind === 'shade');
    updateEnemyState(s, p, 4950, 2, false, true);
    assert.equal(s.active, false);
    assert.equal(s.projectile.active, false);
  }
});
test('gamepads and switches: A or up jumps once, B slides while held, Start pauses, Enter jumps', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window'),
    target = new EventTarget();
  Object.defineProperty(globalThis, 'window', {value: target, configurable: true});
  let jumps = 0,
    pauses = 0,
    sliding = false;
  const controls = new Controls({
    jump: () => jumps++,
    slide: h => {
      sliding = h;
    },
    pause: () => pauses++,
    active: () => true,
  });
  const pad = (pressed: number[], axes = [0, 0]) =>
    padState([{buttons: Array.from({length: 16}, (_, i) => ({pressed: pressed.includes(i)})), axes}, null]);
  try {
    controls.padInput(pad([0]));
    controls.padInput(pad([0]));
    assert.equal(jumps, 1);
    controls.padInput(pad([]));
    controls.padInput(pad([], [0, -1]));
    assert.equal(jumps, 2);
    controls.padInput(pad([1]));
    assert.ok(sliding);
    controls.padInput(pad([]));
    assert.equal(sliding, false);
    controls.padInput(pad([9]));
    assert.equal(pauses, 1);
    target.dispatchEvent(Object.assign(new Event('keydown', {cancelable: true}), {code: 'Enter', repeat: false}));
    assert.equal(jumps, 3);
  } finally {
    controls.destroy();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
