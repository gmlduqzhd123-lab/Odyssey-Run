import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameWatch, HITCH, Pacer, smoothRun} from '../src/rendering/frame-watch';

const feed = (w: FrameWatch, dt: number, seconds: number) => {
  let hit = 0;
  for (let t = 0; t < seconds; t += dt) if (w.add(dt)) hit++;
  return hit;
};

test('smooth play never lowers quality', () => {
  assert.equal(feed(new FrameWatch(), 1 / 60, 30), 0);
  assert.equal(feed(new FrameWatch(), 1 / 45, 30), 0);
});

test('three seconds under 40 fps reports a slow device exactly once', () => {
  const w = new FrameWatch();
  assert.equal(feed(w, 1 / 60, 5), 0);
  assert.equal(feed(w, 1 / 30, 1.5), 0);
  assert.equal(feed(w, 1 / 30, 10), 1);
});

test('single long frames from tab switches are ignored', () => {
  const w = new FrameWatch();
  for (let i = 0; i < 40; i++) assert.equal(w.add(1), false);
  assert.equal(feed(w, 1 / 60, 10), 0);
});

test('the frame watch can fire again after it is rearmed, and averages the whole run', () => {
  const w = new FrameWatch();
  w.begin();
  assert.equal(feed(w, 1 / 30, 5), 1);
  assert.equal(feed(w, 1 / 30, 5), 0);
  w.rearm();
  assert.equal(feed(w, 1 / 30, 5), 1);
  w.begin();
  feed(w, 1 / 60, 30);
  assert.ok(Math.abs(w.fps - 60) < 1);
  assert.ok(w.played > 29);
  assert.ok(smoothRun(w.played, w.fps));
  assert.ok(!smoothRun(10, 60));
  assert.ok(!smoothRun(30, 50));
});

test('a freeze is not caught up in one jump and asks for shelter; a slow device keeps its pace', () => {
  const p = new Pacer();
  for (let i = 0; i < 60; i++) assert.deepEqual(p.step(1 / 60), {time: 1 / 60, hitch: false});
  const freeze = p.step(0.3);
  assert.ok(freeze.hitch);
  assert.ok(freeze.time <= HITCH + 1e-9);
  // A steady 15 fps device: after its first second no frame looks like a freeze, and each is caught up fully.
  const slow = new Pacer();
  let hitches = 0;
  for (let i = 0; i < 120; i++) if (slow.step(1 / 15).hitch) hitches++;
  assert.ok(hitches <= 12, String(hitches));
  assert.equal(slow.step(1 / 15).time, 1 / 15);
  assert.equal(p.step(0).time, 0);
});
