import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAIN_GAP, HIT_STOP, NEAR_PACE, RunFeel} from '../src/systems/run-feel';
import {starNote} from '../src/systems/audio';
import {Announcer} from '../src/systems/announcer';

test('starlight in a row climbs a scale and a gap or a hit starts it again', () => {
  const f = new RunFeel();
  assert.equal(f.event('star', 1, false), 0);
  assert.equal(f.event('star', 1.2, false), 1);
  assert.equal(f.event('star', 1.4, false), 2);
  assert.equal(f.event('star', 1.4 + CHAIN_GAP + 0.1, false), 0);
  assert.equal(f.event('star', 2.2, false), 1);
  f.event('hurt', 2.3, false);
  assert.equal(f.event('star', 2.4, false), 0);
  assert.equal(starNote(0), 950);
  assert.ok(Math.abs(starNote(7) - 1900) < 0.01);
  assert.ok(starNote(1) > starNote(0) && starNote(2) > starNote(1));
  assert.equal(starNote(99), starNote(14));
});

test('a hit holds the picture for a blink and a near miss slows it, never with reduced motion', () => {
  const f = new RunFeel();
  f.event('hurt', 1, false);
  assert.equal(f.pace(1 / 60), 0);
  assert.ok(f.stopped);
  for (let t = 1 / 60; t < HIT_STOP + 0.02; t += 1 / 60) f.pace(1 / 60);
  assert.equal(f.pace(1 / 60), 1);
  f.event('near', 2, false);
  assert.equal(f.pace(1 / 60), NEAR_PACE);
  const calm = new RunFeel();
  calm.event('hurt', 1, true);
  calm.event('near', 1, true);
  assert.equal(calm.pace(1 / 60), 1);
});

test('screen reader notes come one at a time, the latest winning, and skip routine events', () => {
  const a = new Announcer();
  a.push('star');
  assert.equal(a.take(0), '');
  a.push('hurt');
  a.push('map', '지도 조각 발견! +100');
  assert.equal(a.take(1), '지도 조각 발견! +100');
  a.push('fever');
  assert.equal(a.take(1.5), '');
  assert.equal(a.take(2.3), '피버 타임!');
  assert.equal(a.take(5), '');
});
