import test from 'node:test';
import assert from 'node:assert/strict';
import {DISPLAY, displayViewport, displayDensity} from '../src/rendering/display';
test('full viewport preserves a uniform complete 960x540 minimum and hero at 20 percent', () => {
  for (const [w, h] of [
    [1920, 1080],
    [1280, 800],
    [2560, 1080],
    [1024, 768],
    [844, 390],
    [568, 320],
    [740, 300],
    [390, 844],
  ]) {
    const v = displayViewport(w, h);
    assert.ok(v.width >= 960 - 1e-8);
    assert.ok(v.height >= 540 - 1e-8);
    assert.ok(Math.abs(v.width * v.scale - w) < 1e-8);
    assert.ok(Math.abs(v.height * v.scale - h) < 1e-8);
    assert.equal(v.heroX, v.width * 0.2);
    assert.ok(Math.abs((440 + v.extraHeight) * v.scale - (h - 100 * v.scale)) < 1e-8);
  }
});
test('render pixels match the display ratio with an 8.3MP cap even on 4K and ultrawide displays', () => {
  for (const [w, h] of [
    [568, 320],
    [1280, 800],
    [3840, 2160],
    [5120, 1440],
  ])
    for (const dpr of [1, 2, 3]) {
      const v = displayViewport(w, h),
        d = displayDensity(w, dpr, h);
      assert.ok(d > 0 && d <= DISPLAY.maxDensity);
      assert.ok(v.width * v.height * d * d <= DISPLAY.maxPixels + 1);
      assert.ok(v.width * d <= w * Math.min(dpr, 2) + 1e-8);
      assert.ok(v.height * d <= h * Math.min(dpr, 2) + 1e-8);
    }
  assert.equal(displayDensity(3840, 1, 2160), 4);
});
