import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {Runner} from '../src/player/runner';
import {COURSES, CURRENT_PULL, LIFT, MOLY_TIME, SEESAW, STAGES, isCeiling} from '../src/levels/courses';
import {BOSS_COURSES} from '../src/levels/bosses';
import {buildEndless} from '../src/levels/endless';
import {getCourse} from '../src/levels/variants';
import {obstaclePose} from '../src/rendering/poses';

const runFrom = (r: Runner, x: number) => {
  r.state = 'playing';
  r.x = x;
  r.safeX = x;
};

test('pounding columns slam down near the hero and are passed by sliding, never standing', () => {
  const placed = STAGES.filter(id => COURSES[id].obstacles.some(o => o.kind === 'pounder'));
  assert.ok(placed.length >= 4, placed.join());
  const o = COURSES.wind.obstacles.find(o => o.kind === 'pounder')!;
  assert.ok(isCeiling(o.kind) && o.role === 'hazard');
  // Raised while far away, down at its resting place before the hero arrives.
  assert.ok(obstaclePose(o, o.x - 600).y < o.y - 200);
  assert.equal(obstaclePose(o, o.x - 150).y, o.y);
  assert.ok(o.y + o.h < C.ground - C.slide && o.y + o.h > C.ground - C.stand);
  const standing = new Runner('wind');
  runFrom(standing, o.x - 400);
  while (standing.x < o.x + o.w + 60) standing.tick();
  assert.equal(standing.hpLoss, 1);
  assert.equal(standing.damageLog[0].kind, 'pounder');
  const sliding = new Runner('wind');
  runFrom(sliding, o.x - 400);
  while (sliding.x < o.x + o.w + 60) {
    sliding.slide(sliding.x > o.x - 120);
    sliding.tick();
  }
  assert.equal(sliding.hpLoss, 0);
  // One-button voyages duck under it by themselves.
  const auto = new Runner('wind');
  runFrom(auto, o.x - 400);
  auto.autoSlide = true;
  while (auto.x < o.x + o.w + 60) auto.tick();
  assert.equal(auto.hpLoss, 0);
});

test('a seesaw carries a walking hero over its gap, rising in the middle', () => {
  for (const id of STAGES.filter(id => id !== 'wind')) {
    const p = COURSES[id].platforms.find(p => p.seesaw)!,
      gap = COURSES[id].gaps.find(g => g.x > p.x && g.x + g.w < p.x + p.w)!;
    assert.ok(gap, id);
    const r = new Runner(id);
    runFrom(r, p.x - 200);
    let top: number = C.ground;
    while (r.x < p.x + p.w + 80) {
      r.tick();
      if (r.x > p.x && r.x < p.x + p.w) top = Math.min(top, r.y);
    }
    assert.equal(r.hpLoss, 0, id);
    assert.equal(r.y, C.ground, id);
    assert.ok(Math.abs(top - (C.ground - SEESAW.rise)) < 2, `${id} ${top}`);
  }
});

test('a lift is a bridge while it is low and a drop while it is high', () => {
  const p = COURSES.sea.platforms.find(p => p.lift)!;
  const low = new Runner('sea');
  runFrom(low, p.x - 160);
  // Arrive as the lift reaches the bottom of its cycle.
  low.time = LIFT.period - 160 / C.speed - 0.1;
  while (low.x < p.x + p.w + 60) low.tick();
  assert.equal(low.hpLoss, 0);
  const high = new Runner('sea');
  runFrom(high, p.x - 160);
  high.time = LIFT.period / 2 - 160 / C.speed;
  while (high.x < p.x + p.w + 400 && high.hpLoss === 0) high.tick();
  assert.equal(high.damageLog[0]?.kind, 'fall');
});

test("Circe's spell seals the air jump until moly is eaten, on every course and the boss", () => {
  for (const c of [COURSES.circe, getCourse('circe', 'remix-a'), getCourse('circe', 'remix-b'), BOSS_COURSES.circe])
    assert.ok(c.spells?.length, c.routeName ?? c.name);
  assert.ok(buildEndless('circe', 'seed').spells!.length > 4);
  for (const id of STAGES.filter(id => id !== 'circe')) assert.ok(!COURSES[id].spells?.length, id);
  const zone = COURSES.circe.spells![0];
  const jumpTwice = (r: Runner) => {
    runFrom(r, zone.x + 300);
    r.jump();
    for (let i = 0; i < 12; i++) r.tick();
    const before = r.vy;
    r.jump();
    r.tick();
    return r.vy < before - 300;
  };
  const charmed = new Runner('circe');
  assert.equal(jumpTwice(charmed), false);
  assert.ok(charmed.charmed);
  const free = new Runner('circe');
  free.moly = MOLY_TIME;
  assert.equal(jumpTwice(free), true);
  // The sprig lies at the start of each stretch and lasts through the longest one.
  for (const z of COURSES.circe.spells!) {
    const moly = COURSES.circe.items.find(i => i.kind === 'moly' && i.x < z.x && i.x > z.x - 120);
    assert.ok(moly, String(z.x));
    assert.ok(MOLY_TIME * C.speed > z.w + (z.x - moly.x));
  }
});

test("Charybdis's whirlpools slow the hero on the ground but not in the air, on every strait course", () => {
  for (const c of [COURSES.strait, getCourse('strait', 'remix-a'), getCourse('strait', 'remix-b'), BOSS_COURSES.strait])
    assert.ok(c.currents?.length, c.routeName ?? c.name);
  assert.ok(buildEndless('strait', 'seed').currents!.length > 4);
  for (const id of STAGES.filter(id => id !== 'strait')) assert.ok(!COURSES[id].currents?.length, id);
  const z = COURSES.strait.currents![0];
  const walk = new Runner('strait');
  runFrom(walk, z.x + 20);
  walk.tick();
  assert.ok(Math.abs(walk.x - (z.x + 20) - C.speed * CURRENT_PULL * C.step) < 1e-6);
  const leap = new Runner('strait');
  runFrom(leap, z.x - 80);
  leap.jump();
  while (leap.x < z.x + 20) leap.tick();
  const before = leap.x;
  leap.tick();
  assert.ok(Math.abs(leap.x - before - C.speed * C.step) < 1e-6);
});
