import test from 'node:test';
import assert from 'node:assert/strict';
import {Runner} from '../src/player/runner';
import {C} from '../src/config';
import {defaultPreferences, readPreferences} from '../src/storage/preferences';

const approachHand = (autoSlide: boolean) => {
  const r = new Runner('cave');
  r.state = 'playing';
  r.autoSlide = autoSlide;
  r.x = 13200;
  r.invincible = 0;
  for (let i = 0; i < 90; i++) r.tick();
  return r;
};

test('one-button voyages duck under a low hazard that hits a standing hero', () => {
  assert.equal(approachHand(false).hpLoss, 1);
  const r = approachHand(true);
  assert.equal(r.hpLoss, 0);
  assert.ok(r.x > 13400 + 140, 'passed the hand');
  assert.equal(r.sliding, false, 'stands up again once clear');
});

test('auto slide never ducks in the air and still lets the player jump before a gate', () => {
  const r = new Runner('beach');
  r.state = 'playing';
  r.autoSlide = true;
  r.x = 6400 - 300;
  r.jump();
  r.tick();
  assert.ok(r.y < C.ground);
  for (let i = 0; i < 10; i++) r.tick();
  assert.equal(r.sliding, false);
});

test('assist preferences default for older saves and reject unknown values', () => {
  const p = defaultPreferences();
  assert.deepEqual(p.assist, {pace: 1, slideToggle: false, autoSlide: false});
  const old: Partial<typeof p> = structuredClone(p);
  delete old.assist;
  assert.deepEqual(readPreferences(old).assist, p.assist);
  assert.deepEqual(readPreferences({...p, assist: {pace: 0.8, slideToggle: true, autoSlide: true}}).assist, {
    pace: 0.8,
    slideToggle: true,
    autoSlide: true,
  });
  for (const assist of [
    {pace: 0.5, slideToggle: false, autoSlide: false},
    {pace: 1, slideToggle: 'yes', autoSlide: false},
    {pace: 1, slideToggle: false},
    null,
  ])
    assert.throws(() => readPreferences({...p, assist}));
});
