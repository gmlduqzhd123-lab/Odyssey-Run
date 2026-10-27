import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {C, MAX_SCORE} from '../src/config';
import {STAGES, COURSES, SAFE_LEAD} from '../src/levels/courses';
import {VARIANTS, getCourse, COURSE_ORDERS, rearrangeCourse} from '../src/levels/variants';
import {courseKey, type VariantId} from '../src/levels/course-ids';
import {Runner} from '../src/player/runner';
import {emptySave, validateSave, mergeResult, courseRecord, courseGhost, unlocked} from '../src/storage/save';
import {routeInputs} from '../scripts/check-routes';
import {ADVENTURE_PLANS} from '../src/levels/adventure';

function play(
  stage: (typeof STAGES)[number],
  variant: VariantId,
  path: 'lower' | 'upper' = 'upper',
  powers = false,
  goal: 'maps' | 'sky' | 'story' | 'dodge' = 'story',
) {
  const r = new Runner(stage, goal, variant);
  r.state = 'playing';
  if (!powers) {
    const collect = r.collect.bind(r);
    r.collect = i => {
      if (i.kind === 'star' || i.kind === 'map') collect(i);
    };
  }
  const p = routeInputs(stage, path, true, variant);
  let i = 0;
  while (r.state === 'playing' && r.time < 95) {
    while (i < p.jumps.length && r.x >= p.jumps[i]) {
      r.jump();
      i++;
    }
    r.slide(p.slides.some(s => r.x >= s.start && r.x < s.end));
    r.tick();
  }
  return r;
}
test('nine deterministic courses keep original intro/harbor, unique original IDs and score cap', () => {
  assert.equal(MAX_SCORE, 4200);
  const original = structuredClone(COURSES);
  for (const stage of STAGES) {
    assert.equal(getCourse(stage, 'classic'), COURSES[stage]);
    const signatures = new Set<string>();
    for (const v of VARIANTS) {
      const c = getCourse(stage, v);
      signatures.add(JSON.stringify([c.obstacles, c.enemies, c.gaps]));
      assert.equal(c.items.filter(i => i.kind === 'star').length, 100);
      assert.equal(c.items.filter(i => i.kind === 'map').length, 3);
      assert.equal(c.enemies.length, COURSES[stage].enemies.length);
      assert.deepEqual(
        c.items.map(i => i.id),
        COURSES[stage].items.map(i => i.id),
      );
      for (const group of ADVENTURE_PLANS[stage].constellations) {
        const deltas = group.stars.map(
          id => c.items.find(i => i.id === id)!.x - COURSES[stage].items.find(i => i.id === id)!.x,
        );
        assert.equal(new Set(deltas).size, 1, 'constellation must move as an intact pattern');
      }
      for (const field of ['items', 'obstacles', 'enemies', 'winds', 'platforms'] as const)
        assert.deepEqual(
          c[field].filter(o => o.x < 3200 || o.x >= 22400),
          COURSES[stage][field].filter(o => o.x < 3200 || o.x >= 22400),
        );
      for (const x of c.safe) {
        assert.ok(!c.gaps.some(g => x > g.x && x < g.x + g.w));
        assert.ok(!c.obstacles.some(o => o.x >= x && o.x < x + 400));
        assert.ok(!c.enemies.some(e => e.x >= x - 120 && e.x < x + 450));
      }
      for (const i of c.items.filter(i => i.kind === 'compass')) {
        assert.ok(i.checkpoint !== undefined && i.checkpoint < i.x);
        assert.ok(!c.gaps.some(g => i.checkpoint! > g.x - 100 && i.checkpoint! < g.x + g.w + 100));
        assert.ok(!c.obstacles.some(o => o.x >= i.checkpoint! && o.x < i.checkpoint! + 400));
      }
    }
    assert.equal(signatures.size, 3, stage);
    rearrangeCourse(stage, 'remix-a', COURSE_ORDERS[stage]['remix-a']);
  }
  assert.deepEqual(COURSES, original);
});
test('every upper/lower variation completes without items, with zero HP loss and all map pieces', () => {
  for (const stage of STAGES)
    for (const v of VARIANTS)
      for (const path of ['lower', 'upper'] as const) {
        const r = play(stage, v, path);
        const name = `${stage}/${v}/${path}`;
        assert.equal(r.state, 'success', name);
        assert.equal(r.hpLoss, 0, name);
        assert.equal(r.maps.size, 3, name);
        assert.ok(Math.abs(r.time - 75) < 0.05, name);
        assert.equal(r.stories.size, path === 'upper' ? 2 : 1, name);
      }
});
test('all variant challenges and constellations can be earned with authored route inputs', () => {
  let save = emptySave();
  for (const stage of STAGES)
    for (const v of VARIANTS)
      for (const goal of ['maps', 'sky', 'story', 'dodge'] as const) {
        const r = play(stage, v, 'upper', true, goal);
        assert.equal(r.state, 'success');
        assert.equal(r.hpLoss, 0, `${stage}/${v}`);
        assert.ok(r.goalComplete, `${stage}/${v}/${goal}`);
        assert.equal(r.constellations.size, 3, `${stage}/${v}`);
        save = mergeResult(save, r.result());
        assert.deepEqual(validateSave(save), save);
      }
  assert.equal(Object.values(save.courses).filter(r => r?.complete).length, STAGES.length * 3);
  assert.equal(save.journal.stamps.length, STAGES.length * 4);
  assert.equal(save.journal.constellations.length, STAGES.length * 3);
  assert.equal(save.journal.stories.length, STAGES.length * 2);
});
test('each new course recovers a fall to its own flat checkpoint without duplicate collection', () => {
  for (const stage of STAGES)
    for (const v of ['remix-a', 'remix-b'] as const) {
      const r = new Runner(stage, 'maps', v),
        gap = r.course.gaps[0],
        item = r.course.items.find(i => i.kind === 'map')!;
      r.state = 'playing';
      r.collect(item);
      r.shield = true;
      r.x = gap.x + gap.w / 2;
      r.y = 660;
      r.grounded = false;
      r.safeX = r.course.safe.filter(x => x < gap.x - 200).at(-1) ?? 0;
      const safe = r.safeX;
      r.tick();
      assert.equal(r.hpLoss, 1);
      assert.equal(r.hp, 2);
      assert.equal(r.shield, true);
      assert.equal(r.x, safe);
      assert.ok(r.maxDistance > gap.x);
      assert.equal(r.maps.size, 1);
      r.collect(item);
      r.tick();
      assert.equal(r.hpLoss, 1);
      assert.equal(r.maps.size, 1);
      assert.equal(r.state, 'playing');
      assert.equal(r.y, C.ground);
    }
});
test('old v1 imports keep exact core records and attribute previous ghosts only to classic', () => {
  const legacy = JSON.parse(readFileSync('artifacts/legacy-v1-save.json', 'utf8')),
    s = validateSave(legacy);
  // Islands added later start empty; the original records stay exact.
  assert.deepEqual(s.stages, {
    ...legacy.stages,
    sea: {complete: false, bestScore: 0, bestRating: 0, bestStars: 0, maps: []},
  });
  assert.deepEqual(s.settings, legacy.settings);
  for (const stage of STAGES) {
    assert.equal(courseRecord(s, stage, 'classic').bestScore, s.stages[stage].bestScore);
    assert.equal(courseRecord(s, stage, 'remix-a').bestScore, 0);
    assert.equal(courseGhost(s, stage, 'remix-a'), undefined);
  }
  assert.deepEqual(validateSave(s), s);
});
test('variant scores, ghosts and retries remain isolated while stage unlock and discoveries are shared', () => {
  const a = play('beach', 'remix-a', 'upper', true),
    b = play('beach', 'remix-b', 'upper', true);
  let s = mergeResult(emptySave(), a.result());
  assert.ok(unlocked(s, 'cave'));
  assert.equal(courseRecord(s, 'beach', 'classic').bestScore, 0);
  assert.equal(courseGhost(s, 'beach', 'classic'), undefined);
  assert.equal(courseGhost(s, 'beach', 'remix-b'), undefined);
  const prior = structuredClone(courseGhost(s, 'beach', 'remix-a'));
  s = mergeResult(s, b.result());
  assert.deepEqual(courseGhost(s, 'beach', 'remix-a'), prior);
  assert.ok(courseGhost(s, 'beach', 'remix-b'));
  const twice = mergeResult(s, b.result());
  assert.deepEqual(twice.courses, s.courses);
  assert.deepEqual(twice.journal, s.journal);
  assert.deepEqual(twice.stages, s.stages);
  assert.equal(s.stages.beach.maps.length, 3);
  assert.deepEqual(validateSave(s), s);
  const fresh = new Runner('beach', 'story', 'remix-b');
  fresh.state = 'paused';
  fresh.tick();
  assert.equal(fresh.x, 0);
  assert.equal(fresh.hp, 3);
  assert.equal(fresh.collected.size, 0);
  assert.equal(fresh.course, getCourse('beach', 'remix-b'));
  assert.equal(fresh.variant, 'remix-b');
});
test('import refuses invalid variant IDs, cross-stage maps, inflated scores and mismatched ghosts', () => {
  const s = mergeResult(emptySave(), play('beach', 'remix-a', 'upper', true).result()),
    key = courseKey('beach', 'remix-a');
  for (const change of [
    (v: any) => {
      v.courses['beach/unknown'] = v.courses[key];
    },
    (v: any) => {
      v.courses[key].bestScore = 4201;
    },
    (v: any) => {
      v.courses[key].maps = ['wind-map-1'];
    },
    (v: any) => {
      v.courses[key].ghost.samples = [0, 20000];
      v.courses[key].ghost.duration = 1;
    },
    (v: any) => {
      v.courses[key].bestStars = 101;
    },
    (v: any) => {
      v.stages.beach.bestScore = 2900;
    },
  ]) {
    const v = structuredClone(s);
    change(v);
    assert.throws(() => validateSave(v));
  }
});
test('largest supported nine-course traces still fit the 64KiB import limit', () => {
  let s = emptySave();
  for (const stage of STAGES)
    for (const v of VARIANTS) {
      s = mergeResult(s, {
        stage,
        variant: v,
        complete: true,
        score: 4200,
        rating: 3,
        stars: 100,
        maps: [1, 2, 3].map(i => `${stage}-map-${i}`),
        hpLoss: 0,
        distance: C.length,
        adventure: {
          stamps: [],
          stories: [],
          constellations: [],
          combos: [],
          routes: [],
          nearMisses: 0,
          evaded: 0,
          tricked: 0,
          ghost: {score: 4200, duration: 511, samples: Array.from({length: 512}, (_, i) => Math.min(24000, i * 320))},
        },
      });
    }
  for (const stage of STAGES)
    s.expeditions.bosses[stage] = {complete: true, bestScore: 1460, bestRating: 2, bestStars: 0};
  s.expeditions.daily = Array.from({length: 14}, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    complete: true,
    bestScore: 4200,
    bestRating: 3,
    bestStars: 100,
  }));
  assert.deepEqual(validateSave(s), s);
  assert.ok(Buffer.byteLength(JSON.stringify(s), 'utf8') < 65536);
});
test('every gap on every course has clear respawn ground 600-2400px before it', () => {
  for (const stage of STAGES)
    for (const v of VARIANTS) {
      const c = getCourse(stage, v);
      for (const g of c.gaps) {
        const back = c.safe.filter(x => x < g.x).at(-1)!;
        assert.ok(g.x - back <= SAFE_LEAD.max, `${stage}/${v} gap ${g.x} returns to ${back}`);
        assert.ok(g.x - back >= 200, `${stage}/${v} gap ${g.x} respawn too close`);
      }
    }
  const r = new Runner('cave');
  r.state = 'playing';
  r.x = 13300;
  for (let i = 0; i < 20; i++) r.tick();
  r.x = 13950;
  r.y = 660;
  r.grounded = false;
  r.tick();
  assert.ok(r.x >= 13900 - SAFE_LEAD.max, 'cave fall at 13900 returns near the gap');
});
