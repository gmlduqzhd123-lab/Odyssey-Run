import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {Runner} from '../src/player/runner';
import {COURSES, CRUMBLE_DELAY, STAGES} from '../src/levels/courses';
import {BOSS_COURSES} from '../src/levels/bosses';
import {buildEndless} from '../src/levels/endless';
import {SPARE_VIEWS, decorFor, harborMix, sceneryView} from '../src/levels/scenery';
import {REGIONS} from '../src/assets/terrain';
import {SCENERY_ART, SCENERY_MASKS} from '../src/assets/scenery-art';

test('every island has spike traps and a crumbling bridge from the terrain sheet', () => {
  for (const id of STAGES) {
    const c = COURSES[id],
      spikes = c.obstacles.filter(o => o.kind === 'spikes'),
      bridges = c.platforms.filter(p => p.crumble);
    assert.ok(spikes.length >= 1, id);
    assert.ok(
      spikes.every(s => s.role === 'hazard' && s.y + s.h === C.ground),
      id,
    );
    assert.equal(bridges.length, 1, id);
    // The bridge spans exactly a gap, so standing on it only ever happens over the drop.
    assert.ok(
      c.gaps.some(g => g.x === bridges[0].x && g.w === bridges[0].w),
      id,
    );
  }
  assert.ok(SCENERY_MASKS['obstacle-spikes'].rows.filter(r => r.length).length > 30);
});

test('running into spikes costs a heart; a shield still blocks them', () => {
  const s = COURSES.wind.obstacles.find(o => o.kind === 'spikes')!;
  const r = new Runner('wind');
  r.state = 'playing';
  r.x = s.x - 80;
  while (r.x < s.x + s.w + 40) r.tick();
  assert.equal(r.hpLoss, 1);
  assert.equal(r.damageLog[0].kind, 'spikes');
  const guarded = new Runner('wind');
  guarded.state = 'playing';
  guarded.x = s.x - 80;
  guarded.shield = true;
  while (guarded.x < s.x + s.w + 40) guarded.tick();
  assert.equal(guarded.hpLoss, 0);
});

test('a crumbling bridge holds briefly, gives way, and is whole again after the fall', () => {
  const bridge = COURSES.beach.platforms.find(p => p.crumble)!;
  const r = new Runner('beach');
  r.state = 'playing';
  r.x = bridge.x - 40;
  r.safeX = bridge.x - 600;
  let firstStep = -1;
  while (r.state === 'playing' && r.hpLoss === 0 && r.time < 5) {
    r.tick();
    if (firstStep < 0 && r.crumbleAge(bridge) >= 0) firstStep = r.x;
  }
  assert.ok(firstStep >= bridge.x, 'the bridge is only stood on over the gap');
  assert.equal(r.damageLog.at(-1)?.kind, 'fall');
  assert.equal(r.crumbleAge(bridge), -1, 'restored after the fall');
  // Jumping before it gives way crosses safely.
  const j = new Runner('beach');
  j.state = 'playing';
  j.x = bridge.x - 10;
  for (let t = 0; t < CRUMBLE_DELAY * 0.5; t += C.step) j.tick();
  j.jump();
  j.jump();
  for (let t = 0; t < 1.5; t += C.step) j.tick();
  assert.equal(j.hpLoss, 0);
});

test('special voyages are painted with the five landscapes no island owns', () => {
  const used = new Set<string>([
    ...STAGES.map(id => sceneryView(BOSS_COURSES[id])),
    sceneryView(buildEndless('beach', 'seed', 2)),
    ...[0, 1, 2, 3, 4].map(day => sceneryView(COURSES.beach, 'daily', day)),
  ]);
  for (const v of SPARE_VIEWS) {
    assert.ok(used.has(v), v);
    assert.ok(v in REGIONS, v);
  }
  for (const id of STAGES) assert.equal(sceneryView(COURSES[id]), `view-${id}`);
  // Ithaca rises only at the end of an island voyage.
  assert.equal(harborMix(COURSES.beach, 1000), 0);
  assert.equal(harborMix(COURSES.beach, C.length), 1);
  assert.equal(harborMix(BOSS_COURSES.beach, 9600), 0);
});

test('decorations stand clear of gaps, obstacles and the crumbling bridge', () => {
  for (const id of STAGES) {
    const c = COURSES[id],
      decor = decorFor(c);
    assert.ok(decor.length >= 10, id);
    for (const d of decor) {
      assert.ok(d.frame in SCENERY_ART.frames);
      assert.ok(!c.gaps.some(g => d.x > g.x - 160 && d.x < g.x + g.w + 120), `${id} ${d.id}`);
      assert.ok(!c.obstacles.some(o => d.x > o.x - 240 && d.x < o.x + o.w + 180), `${id} ${d.id}`);
    }
  }
});
