import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave, mergeResult, SaveStore, SAVE_KEY, type RunResult} from '../src/storage/save';
import {mergeSaves} from '../src/storage/merge';

class Memory {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}
const run = (stage: RunResult['stage'], score: number, maps: string[] = [], complete = true): RunResult => ({
  stage,
  complete,
  score,
  rating: complete ? 1 : 0,
  stars: 0,
  maps,
  hpLoss: 1,
  distance: 24000,
});

test('merging keeps the best of both copies and settings from the newer one', () => {
  let a = mergeResult(emptySave(), run('beach', 3100, ['beach-map-1']));
  let b = mergeResult(emptySave(), run('beach', 3300, ['beach-map-2']));
  b = mergeResult(b, run('cave', 3000));
  a.quiz = ['owl'];
  b.quiz = ['home'];
  a.endless = {beach: {bestScore: 900, bestDistance: 8000}};
  b.settings.music = false;
  a.savedAt = '2026-10-27T01:00:00.000Z';
  b.savedAt = '2026-10-27T02:00:00.000Z';
  const m = mergeSaves(a, b);
  assert.equal(m.stages.beach.bestScore, 3300);
  assert.deepEqual([...m.stages.beach.maps].sort(), ['beach-map-1', 'beach-map-2']);
  assert.equal(m.stages.cave.complete, true);
  assert.deepEqual([...m.quiz].sort(), ['home', 'owl']);
  assert.equal(m.endless.beach?.bestDistance, 8000);
  assert.equal(m.settings.music, false);
  const r = mergeSaves(b, a);
  for (const id of ['beach', 'cave'] as const) {
    assert.equal(r.stages[id].bestScore, m.stages[id].bestScore);
    assert.deepEqual([...r.stages[id].maps].sort(), [...m.stages[id].maps].sort());
  }
});

test('two tabs of one sailor both keep their progress when saving', () => {
  const m = new Memory(),
    tab1 = new SaveStore(m),
    tab2 = new SaveStore(m);
  tab1.data = mergeResult(tab1.data, run('beach', 3100));
  tab1.persist();
  tab2.data = mergeResult(tab2.data, run('beach', 2000, ['beach-map-3'], false));
  tab2.persist();
  const saved = new SaveStore(m).data;
  assert.equal(saved.stages.beach.complete, true, 'tab1 completion survives tab2 save');
  assert.equal(saved.stages.beach.bestScore, 3100);
  assert.deepEqual(saved.stages.beach.maps, ['beach-map-3']);
  assert.equal(tab2.adopt(m.getItem(SAVE_KEY)), false, 'own write is not re-adopted');
});
