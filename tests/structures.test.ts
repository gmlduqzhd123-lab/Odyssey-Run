import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/player/runner';
import {COURSES, STAGES, type Course, type Obstacle} from '../src/levels/courses';
import {VARIANTS, getCourse} from '../src/levels/variants';
import {BOSS_COURSES} from '../src/levels/bosses';
import {C} from '../src/config';
import {heroPose, obstaclePose} from '../src/rendering/poses';
import {obstacleContact, overlaps} from '../src/systems/contact';
function isolated(obstacles: Obstacle[], platforms: Course['platforms'] = []) {
  const source = COURSES.beach;
  const course: Course = {
    ...source,
    obstacles,
    platforms,
    items: [],
    enemies: [],
    gaps: [],
    winds: [],
    safe: [0],
    adventure: {
      branch: {id: 'test-upper', start: 30000, end: 31000, y: 330},
      stories: [],
      constellations: [],
      highlight: {id: 'test', start: 30000, end: 31000, name: 'test', hint: ''},
    },
  };
  const r = new Runner('beach', 'maps', 'classic', course);
  r.state = 'playing';
  r.x = 1035;
  return r;
}
const obstacle = (kind: Obstacle['kind'], role: Obstacle['role']): Obstacle => ({
  id: 'test-' + kind,
  kind,
  role,
  x: 1000,
  y: kind === 'pillar' ? 320 : kind === 'gate' ? 279 : 392,
  w: kind === 'gate' ? 160 : 70,
  h: kind === 'pillar' ? 120 : kind === 'gate' ? 125 : 48,
});
test('normal and boss courses explicitly classify every obstacle; variants retain roles', () => {
  for (const id of STAGES) {
    for (const v of VARIANTS) {
      const course = getCourse(id, v);
      for (const o of course.obstacles) {
        assert.ok(['structure', 'hazard'].includes(o.role));
        assert.equal(o.role, ['crate', 'pillar', 'gate'].includes(o.kind) ? 'structure' : 'hazard');
      }
      assert.equal(course.items.filter(i => i.kind === 'star').length, 100);
      assert.equal(course.items.filter(i => i.kind === 'map').length, 3);
    }
    for (const o of BOSS_COURSES[id].obstacles) assert.equal(o.role, 'hazard');
  }
});
test('crate, pillar and gate contacts preserve HP, shield, damage log and invincibility', () => {
  for (const kind of ['crate', 'pillar', 'gate'] as const)
    for (const shield of [false, true]) {
      const o = obstacle(kind, 'structure'),
        r = isolated([o]);
      r.shield = shield;
      assert.ok(overlaps(r.body, o));
      for (let i = 0; i < 12; i++) r.tick(0);
      assert.equal(r.hp, 3, kind);
      assert.equal(r.shield, shield, kind);
      assert.equal(r.hpLoss, 0);
      assert.equal(r.invincible, 0);
      assert.equal(r.damageLog.length, 0);
      assert.ok(!r.events.some(e => ['hurt', 'block', 'fall'].includes(e.kind)));
      assert.equal(r.nearMisses.size, 0);
    }
});
test('damage follows the explicit role, not the asset name, with one hit per invincibility window', () => {
  const safe = isolated([obstacle('crate', 'structure')]);
  safe.tick(0);
  assert.equal(safe.hp, 3);
  const r = isolated([obstacle('crate', 'hazard'), {...obstacle('rock', 'hazard'), id: 'second-hazard'}]);
  r.tick(0);
  assert.equal(r.hp, 2);
  assert.equal(r.hpLoss, 1);
  assert.equal(r.invincible, C.invincible);
  for (let i = 0; i < 60; i++) {
    r.x = 1035;
    r.tick();
  }
  assert.equal(r.hp, 2);
  assert.equal(r.hpLoss, 1);
  r.invincible = 0;
  r.x = 1035;
  r.tick(0);
  assert.equal(r.hp, 1);
  assert.equal(r.hpLoss, 2);
  const protectedRun = isolated([obstacle('crate', 'hazard'), {...obstacle('rock', 'hazard'), id: 'second'}]);
  protectedRun.shield = true;
  protectedRun.tick(0);
  assert.equal(protectedRun.hp, 3);
  assert.equal(protectedRun.shield, false);
  assert.equal(protectedRun.hpLoss, 0);
  assert.equal(protectedRun.damageLog.length, 0);
});
test('transparent hazard corners do not damage or spend a shield, opaque contact does', () => {
  const o: Obstacle = {id: 'rock', kind: 'rock', role: 'hazard', x: 1020, y: 397, w: 36, h: 28},
    r = isolated([o]);
  r.x = 1000;
  r.y = 400;
  r.grounded = false;
  r.coyote = 0;
  r.shield = true;
  assert.ok(overlaps(r.body, o));
  assert.equal(obstacleContact(heroPose(r), r.body, o, r.x), false);
  r.tick(0);
  assert.equal(r.shield, true);
  assert.equal(r.invincible, 0);
  const actual = {...o, x: 990, y: 370};
  assert.equal(obstacleContact(heroPose(r), r.body, actual, r.x), true);
});
test('falling rocks and hands use the same displayed position as their contact silhouette', () => {
  const rock: Obstacle = {id: 'falling', kind: 'falling', role: 'hazard', x: 2000, y: 376, w: 60, h: 64},
    hand: Obstacle = {id: 'hand', kind: 'hand', role: 'hazard', x: 2000, y: 365, w: 140, h: 39};
  assert.equal(obstaclePose(rock, 1500).y, 86);
  assert.equal(obstaclePose(rock, 1900).y, 376);
  assert.equal(obstaclePose(hand, 1500).y, 105);
  assert.equal(obstaclePose(hand, 1850).y, 365);
  assert.equal(obstaclePose(rock, 1900).mask, 'obstacle-rock');
  assert.equal(obstaclePose(hand, 1850).mask, 'obstacle-hand');
});
test('safe low ceiling still blocks standing and jumping until clear; feet remain grounded', () => {
  const r = isolated([obstacle('gate', 'structure')]);
  r.slide(true);
  r.tick();
  r.slide(false);
  r.jump();
  r.tick();
  assert.equal(r.sliding, true);
  assert.equal(r.jumps, 0);
  assert.equal(r.y, C.ground);
  assert.equal(r.hp, 3);
  r.x = 1190;
  r.buffer = 0;
  r.tick();
  assert.equal(r.sliding, false);
  assert.equal(r.y, C.ground);
  assert.equal(r.hpLoss, 0);
});
test('safe platform landing has no contact damage; falling still bypasses shield and preserves score IDs', () => {
  const r = isolated([], [{id: 'platform', x: 980, y: 330, w: 180}]);
  r.y = 328;
  r.vy = 200;
  r.grounded = false;
  r.shield = true;
  r.tick();
  assert.equal(r.y, 330);
  assert.equal(r.grounded, true);
  assert.equal(r.hp, 3);
  assert.equal(r.shield, true);
  assert.equal(r.hpLoss, 0);
  r.maxDistance = 9000;
  r.collected.add('collected-once');
  r.safeX = 700;
  r.y = 660;
  r.grounded = false;
  r.invincible = 1;
  r.tick();
  assert.equal(r.hp, 2);
  assert.equal(r.shield, true);
  assert.equal(r.x, 700);
  assert.equal(r.maxDistance, 9000);
  assert.ok(r.collected.has('collected-once'));
  assert.equal(r.damageLog.at(-1)?.kind, 'fall');
});
test('rising into the side of a gate stops the climb without snapping to the floor', () => {
  const r = isolated([obstacle('gate', 'structure')]);
  r.x = 978;
  r.y = 340;
  r.vy = -300;
  r.grounded = false;
  r.jumps = 1;
  r.tick();
  assert.ok(Math.abs(r.y - 340) < 10, 'no teleport, y=' + r.y);
  assert.equal(r.grounded, false);
  assert.equal(r.jumps, 1);
  assert.ok(r.vy >= 0);
  const under = isolated([obstacle('gate', 'structure')]);
  under.x = 1080;
  under.y = 470;
  under.vy = -300;
  under.grounded = false;
  under.tick();
  assert.equal(under.y, 404 + C.stand);
});
