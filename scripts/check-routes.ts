import {Runner} from '../src/player/runner';
import {STAGES} from '../src/levels/courses';
import {routeInputs} from '../src/levels/route-inputs';
export {routeInputs};
if (process.argv[1]?.includes('check-routes'))
  for (const id of STAGES) {
    const r = new Runner(id);
    r.state = 'playing';
    const input = routeInputs(id);
    let idx = 0;
    const damage: number[] = [];
    while (r.state === 'playing' && r.time < 100) {
      while (idx < input.jumps.length && r.x >= input.jumps[idx]) {
        r.jump();
        idx++;
      }
      r.slide(input.slides.some(s => r.x >= s.start && r.x < s.end));
      const hp = r.hpLoss;
      r.tick();
      if (r.hpLoss > hp) damage.push(Math.round(r.x));
    }
    console.log(
      id,
      r.state,
      Math.round(r.time * 100) / 100,
      'sec',
      r.hp,
      'HP',
      r.stars,
      'stars',
      Array.from(r.maps),
      damage,
    );
  }
