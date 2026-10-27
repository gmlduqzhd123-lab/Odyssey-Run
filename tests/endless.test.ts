import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/player/runner';
import {STAGES} from '../src/levels/courses';
import {buildEndless, endlessOrder, endlessLength, sectionsPassed, ENDLESS_SECTIONS} from '../src/levels/endless';
import {routeInputs} from '../scripts/check-routes';
import {emptySave, validateSave, mergeResult} from '../src/storage/save';

test('endless orders are seeded shuffles of all six sections without back-to-back repeats', () => {
  const a = endlessOrder('2026-10-27:beach'),
    b = endlessOrder('2026-10-27:beach');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, endlessOrder('2026-10-28:beach'));
  assert.equal(a.length, ENDLESS_SECTIONS);
  for (let i = 0; i < a.length; i += 6) assert.deepEqual([...a.slice(i, i + 6)].sort(), [0, 1, 2, 3, 4, 5]);
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1]);
});

test('endless courses copy sections with unique ids, no maps or stories, and a far finish', () => {
  for (const stage of STAGES) {
    const c = buildEndless(stage, 'seed:' + stage);
    assert.equal(c.mode, 'endless');
    assert.equal(c.length, endlessLength());
    for (const list of [c.items, c.obstacles, c.enemies, c.platforms])
      assert.equal(new Set(list.map(o => o.id)).size, list.length);
    assert.equal(c.items.filter(i => i.kind === 'map').length, 0);
    assert.equal(c.adventure!.stories.length, 0);
    assert.ok(c.items.filter(i => i.kind === 'star').length > 800);
    for (const i of c.items) if (i.checkpoint !== undefined) assert.ok(i.checkpoint < i.x && i.x - i.checkpoint < 400);
  }
});

test('scripted lower routes pass the first eighteen endless sections on every island without damage', () => {
  for (const stage of STAGES) {
    const c = buildEndless(stage, '2026-10-27:' + stage, 18),
      r = new Runner(stage, 'maps', 'classic', c),
      p = routeInputs(stage, 'lower', false, 'classic', c);
    r.state = 'playing';
    let i = 0;
    while (r.state === 'playing' && r.time < 300) {
      while (i < p.jumps.length && r.x >= p.jumps[i]) {
        r.jump();
        i++;
      }
      r.slide(p.slides.some(s => r.x >= s.start && r.x < s.end));
      r.tick();
    }
    assert.equal(r.state, 'success', stage);
    assert.equal(r.hpLoss, 0, stage + ' ' + JSON.stringify(r.damageLog));
    assert.equal(sectionsPassed(r.maxDistance), 18);
    assert.ok(r.points > 2400 + 1800, 'distance score is not capped at the normal course length');
  }
});

test('endless bests are saved only for completed islands and with consistent distance', () => {
  const s = mergeResult(emptySave(), {
    stage: 'beach',
    complete: true,
    score: 3000,
    rating: 1,
    stars: 0,
    maps: [],
    hpLoss: 1,
    distance: 24000,
  });
  assert.deepEqual(validateSave({...s, endless: {beach: {bestScore: 9000, bestDistance: 80000}}}).endless, {
    beach: {bestScore: 9000, bestDistance: 80000},
  });
  const old: Partial<typeof s> = structuredClone(s);
  delete old.endless;
  assert.deepEqual(validateSave(old).endless, {});
  assert.throws(() => validateSave({...s, endless: {cave: {bestScore: 10, bestDistance: 100}}}));
  assert.throws(() => validateSave({...s, endless: {beach: {bestScore: 10, bestDistance: 80000}}}));
  assert.throws(() => validateSave({...s, endless: {beach: {bestScore: 10, bestDistance: endlessLength() + 1}}}));
});
