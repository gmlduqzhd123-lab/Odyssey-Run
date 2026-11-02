import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave, validateSave} from '../src/storage/save';
import {HEROES, heroUnlocked} from '../src/systems/heroes';
import {quizIds} from '../src/levels/quiz';
import {storyIds} from '../src/levels/adventure';
import {PEOPLE} from '../src/assets/catalog';

test('four heroes, each with a portrait; only Odysseus is open at first', () => {
  assert.deepEqual(
    HEROES.map(h => h.id),
    ['odysseus', 'telemachus', 'penelope', 'athena'],
  );
  for (const h of HEROES)
    assert.ok(
      PEOPLE.some(p => p.id === h.id),
      h.id,
    );
  const s = emptySave();
  assert.deepEqual(
    HEROES.filter(h => heroUnlocked(s, h.id)).map(h => h.id),
    ['odysseus'],
  );
  assert.equal(s.preferences.hero, 'odysseus');
});

test('heroes open with map fragments, hidden stories and quiz answers, and saves keep them honest', () => {
  const s = emptySave();
  s.stages.beach = {
    complete: true,
    bestScore: 3600,
    bestRating: 1,
    bestStars: 40,
    maps: ['beach-map-1', 'beach-map-2', 'beach-map-3'],
  };
  s.stages.cave = {
    complete: true,
    bestScore: 3600,
    bestRating: 1,
    bestStars: 40,
    maps: ['cave-map-1', 'cave-map-2', 'cave-map-3'],
  };
  assert.ok(heroUnlocked(s, 'telemachus'));
  s.journal.stories = storyIds.slice(0, 4);
  assert.ok(heroUnlocked(s, 'penelope'));
  assert.ok(!heroUnlocked(s, 'athena'));
  s.preferences.hero = 'athena';
  assert.throws(() => validateSave(s), /영웅/);
  s.quiz = quizIds.slice(0, 10);
  assert.equal(validateSave(s).preferences.hero, 'athena');
  // Saves from before playable heroes have no hero and run as Odysseus.
  const old = structuredClone(s) as unknown as {preferences: Record<string, unknown>};
  delete old.preferences.hero;
  assert.equal(validateSave(old).preferences.hero, 'odysseus');
});

test('the see-through ghost runner is on by default and older saves keep it on', () => {
  const s = emptySave();
  assert.equal(s.preferences.ghostRunner, true);
  s.preferences.ghostRunner = false;
  assert.equal(validateSave(s).preferences.ghostRunner, false);
  const old = structuredClone(s) as unknown as {preferences: Record<string, unknown>};
  delete old.preferences.ghostRunner;
  assert.equal(validateSave(old).preferences.ghostRunner, true);
  old.preferences.ghostRunner = 'yes';
  assert.throws(() => validateSave(old), /고스트/);
});

test('hazard marks and switch scanning are off by default, saved, and checked on import', () => {
  const s = emptySave();
  assert.equal(s.preferences.hazardMarks, false);
  assert.equal(s.preferences.switchScan, false);
  s.preferences.hazardMarks = true;
  s.preferences.switchScan = true;
  const back = validateSave(s);
  assert.ok(back.preferences.hazardMarks && back.preferences.switchScan);
  const bad = structuredClone(s) as unknown as {preferences: Record<string, unknown>};
  bad.preferences.switchScan = 1;
  assert.throws(() => validateSave(bad), /도움/);
});
