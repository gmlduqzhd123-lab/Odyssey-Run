import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {STAGES} from '../src/levels/courses';
import {VARIANTS} from '../src/levels/course-ids';
import {getCourse} from '../src/levels/variants';
import {gateFor} from '../src/levels/play-extras';
import {
  CHASE_BONUS,
  FEVER_TIME,
  MISSION_REWARD,
  ROPE_END,
  chaseFor,
  dynamicsFor,
  missionsFor,
} from '../src/levels/play-dynamics';
import {Runner} from '../src/player/runner';
import {buildEndless} from '../src/levels/endless';
import {arpNote, beatsIn} from '../src/systems/music-layers';
import {clock, liveLeft, liveMarkup, readLive} from '../src/ui/class-view';

const ordinary = (stage: (typeof STAGES)[number] = 'beach') => {
  const r = new Runner(stage);
  r.extras = true;
  r.state = 'playing';
  return r;
};

test('every island course has a spring and a rope, on plain ground apart from the gate', () => {
  let ropes = 0;
  for (const stage of STAGES)
    for (const variant of VARIANTS) {
      const course = getCourse(stage, variant),
        gate = gateFor(course, 'x'),
        d = dynamicsFor(course, gate);
      assert.ok(d.spring !== null, `${stage}/${variant} spring`);
      assert.ok(d.rope !== null, `${stage}/${variant} rope`);
      ropes++;
      for (const x of [d.spring!, d.rope].filter((x): x is number => x !== null)) {
        assert.ok(!course.gaps.some(g => g.x < x + 700 && g.x + g.w > x - 250), `${stage}/${variant} gap at ${x}`);
        assert.ok(
          !course.obstacles.some(o => o.role === 'hazard' && o.x < x + 700 && o.x + o.w > x - 250),
          `${stage}/${variant} hazard`,
        );
        if (gate) assert.ok(Math.abs(x - (gate.x - 350)) > 1200);
      }
      const missions = missionsFor(course, STAGES.indexOf(stage));
      assert.equal(missions.length, 2);
      const chase = chaseFor(course);
      assert.ok(chase.start < chase.end);
    }
  assert.equal(ropes, STAGES.length * VARIANTS.length);
});

test('landing on a crab defeats it and bounces; running into it still hurts', () => {
  const r = new Runner('beach');
  r.state = 'playing';
  const crab = r.enemyStates.find(e => e.kind === 'crab')!;
  crab.active = true;
  r.x = r.prevX = crab.x + crab.w / 2;
  r.prevY = crab.y - 6;
  r.y = crab.y - 6;
  r.vy = 300;
  r.grounded = false;
  // The private stomp check runs inside a tick; place the hero just above and step once.
  r.tick();
  assert.equal(r.stomps, 1);
  assert.ok(crab.defeated);
  assert.ok(r.vy < 0);
  assert.equal(r.hp, 3);
  assert.equal(
    r.events.some(e => e.kind === 'stomp'),
    true,
  );
});

test('fever fills from the combo, shelters for five seconds and doubles combo points', () => {
  const r = ordinary();
  const stars = r.course.items.filter(i => i.kind === 'star');
  for (const s of stars.slice(0, 34)) r.collect(s);
  assert.ok(r.fever > 0, String(r.feverGauge));
  assert.equal(r.fever, FEVER_TIME);
  assert.equal(r.fevers, 1);
  const hp = r.hp;
  r.hurt();
  assert.equal(r.hp, hp);
  const before = r.comboPoints;
  r.collect(stars[40]);
  assert.ok(r.comboPoints - before >= 20);
  // Only ordinary runs fill the gauge.
  const plain = new Runner('beach');
  plain.state = 'playing';
  for (const s of stars.slice(0, 50)) plain.collect(s);
  assert.equal(plain.fever, 0);
});

test('the spring launches the hero high and the rope throws a jumping hero up', () => {
  const r = ordinary();
  r.springs = [500];
  r.x = r.prevX = 480;
  for (let i = 0; i < 4 && !r.events.some(e => e.kind === 'spring'); i++) r.tick();
  assert.ok(r.events.some(e => e.kind === 'spring'));
  assert.ok(r.vy < C.jump);
  const q = ordinary();
  q.ropes = [1000];
  q.x = q.prevX = 1000;
  q.y = ROPE_END.y + 32;
  q.vy = -100;
  q.grounded = false;
  q.tick();
  assert.ok(q.ropesUsed.has(1000));
  assert.ok(q.events.some(e => e.kind === 'swing'));
});

test('surprise missions start on time, pay out and can be missed; the chase pays an untouched escape', () => {
  const r = ordinary();
  r.missions = [{kind: 'clean', at: 100, goal: 1, seconds: 1}];
  r.x = r.prevX = 120;
  r.tick();
  assert.ok(r.mission);
  for (let i = 0; i < 70; i++) {
    r.y = C.ground;
    r.tick();
  }
  assert.equal(r.missionsDone, 1);
  assert.ok(r.comboPoints >= MISSION_REWARD);
  const f = ordinary();
  f.missions = [{kind: 'stars', at: 100, goal: 50, seconds: 1}];
  f.x = f.prevX = 120;
  for (let i = 0; i < 70; i++) f.tick();
  assert.equal(f.missionsDone, 0);
  assert.ok(f.events.length >= 0);
  const c = ordinary();
  c.chase = {start: 100, end: 300};
  c.x = c.prevX = 110;
  c.tick();
  assert.ok(c.chasing);
  c.x = 400;
  c.tick();
  assert.ok(c.chaseEscaped);
  assert.ok(c.comboPoints >= CHASE_BONUS);
  const h = ordinary();
  h.chase = {start: 100, end: 300};
  h.x = h.prevX = 110;
  h.tick();
  h.hurt();
  h.invincible = 0;
  h.x = 400;
  h.tick();
  assert.ok(!h.chaseEscaped);
  assert.equal(h.chaseHits, 1);
});

test('a fallen partner comes back with one heart', () => {
  const r = new Runner('beach');
  r.state = 'failure';
  r.hp = 0;
  r.safeX = 1200;
  r.revive();
  assert.equal(r.state, 'playing');
  assert.equal(r.hp, 1);
  assert.equal(r.x, 1200);
});

test('the shuffled route runs the six sections once, and music layers sit on the theme beat', () => {
  const a = buildEndless('beach', 'shuffle:2026-11-24:beach', 6),
    b = buildEndless('beach', 'shuffle:2026-11-25:beach', 6);
  assert.equal(a.length, 3200 + 6 * 3200 + 800);
  assert.notDeepEqual(
    a.obstacles.map(o => o.id),
    b.obstacles.map(o => o.id),
  );
  const beats = beatsIn(10, 120, 10, 11);
  assert.deepEqual(
    beats.map(b => b.k),
    [0, 1],
  );
  assert.ok(Math.abs(beats[1].t - 10.5) < 1e-9);
  assert.equal(beatsIn(10, 120, 11.2, 11.4).length, 0);
  assert.ok(arpNote(220, 0) === 440);
});

test('the live mission reads only sound settings and counts from its start', () => {
  assert.equal(readLive('nope'), null);
  assert.equal(readLive(JSON.stringify({start: 1, minutes: 7, goal: 100, base: 0})), null);
  const m = readLive(JSON.stringify({start: 1000, minutes: 5, goal: 100, base: 40}))!;
  assert.equal(liveLeft(m, 1000 + 60_000), 4 * 60_000);
  assert.equal(liveLeft(m, 1000 + 10 * 60_000), 0);
  assert.equal(clock(65_000), '1:05');
  assert.match(liveMarkup(m, 100, 5, 1000), /별빛 60 \/ 100/);
  assert.match(liveMarkup(m, 150, 5, 1000), /미션 성공/);
  assert.match(liveMarkup(null, 0, 5, 0), /live-start/);
});
