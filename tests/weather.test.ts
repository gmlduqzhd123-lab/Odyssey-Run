import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {Runner} from '../src/player/runner';
import {STAGES} from '../src/levels/courses';
import {VARIANTS} from '../src/levels/course-ids';
import {FOG, STORM_SPEED, WEATHERS, isWeather} from '../src/levels/weather';
import {routeInputs} from '../scripts/check-routes';

test('weather choices are four, and only the storm changes how the run moves', () => {
  assert.deepEqual(Object.keys(WEATHERS), ['clear', 'rain', 'storm', 'fog']);
  assert.ok(isWeather('fog') && !isWeather('snow'));
  assert.ok(STORM_SPEED > 0.8 && STORM_SPEED < 1);
  assert.ok(FOG.clear < FOG.hidden);
  const r = new Runner('beach');
  assert.equal(r.weather, 'clear');
  assert.equal(r.speed, C.speed);
});

test('every course stays clear in the storm with the same reaction times', () => {
  for (const stage of STAGES)
    for (const variant of VARIANTS) {
      const r = new Runner(stage, 'maps', variant);
      r.weather = 'storm';
      r.speed = C.speed * STORM_SPEED;
      r.state = 'playing';
      const collect = r.collect.bind(r);
      r.collect = i => {
        if (i.kind === 'star' || i.kind === 'map') collect(i);
      };
      const p = routeInputs(stage, 'lower', false, variant, undefined, STORM_SPEED);
      let i = 0;
      while (r.state === 'playing' && r.time < 120) {
        while (i < p.jumps.length && r.x >= p.jumps[i]) {
          r.jump();
          i++;
        }
        r.slide(p.slides.some(s => r.x >= s.start && r.x < s.end));
        r.tick();
      }
      const name = `${stage}/${variant}`;
      assert.equal(r.state, 'success', name);
      assert.equal(r.hpLoss, 0, name + ' ' + JSON.stringify(r.damageLog));
      assert.equal(r.maps.size, 3, name);
      // About a tenth longer than the 75-second calm voyage.
      assert.ok(r.time > 80 && r.time < 86, `${name} ${r.time}`);
    }
});
