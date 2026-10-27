import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameWatch} from '../src/rendering/frame-watch';

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
