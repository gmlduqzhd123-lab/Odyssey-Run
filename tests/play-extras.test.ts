import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {STAGES} from '../src/levels/courses';
import {VARIANTS} from '../src/levels/course-ids';
import {getCourse} from '../src/levels/variants';
import {BOSS_COURSES} from '../src/levels/bosses';
import {BLESSING_IDS, GATE_LEAD, comboMultiplier, gateFor, gateStatement, treasureFor} from '../src/levels/play-extras';
import {Runner} from '../src/player/runner';
import {emptyPlay, mergePlay, playRun, readPlay, TREASURE_KEYS} from '../src/storage/play';
import {emptySave, validateSave} from '../src/storage/save';
import {recordRun} from '../src/storage/feats';
import {dailyPassed, dailySpec} from '../src/levels/daily';

test('every island course has a hidden chest above a plank and an O/X gate on plain ground', () => {
  for (const stage of STAGES)
    for (const variant of VARIANTS) {
      const course = getCourse(stage, variant),
        t = treasureFor(course),
        g = gateFor(course, `${stage}/${variant}/2026-11-24`);
      assert.ok(t, `${stage}/${variant} chest`);
      assert.equal(t.id, `${stage}/${variant}`);
      assert.ok(TREASURE_KEYS.includes(t.id));
      assert.ok(t.y > 20 && t.y < C.ground - 150, `${stage}/${variant} chest height ${t.y}`);
      assert.ok(g, `${stage}/${variant} gate`);
      assert.ok(!course.gaps.some(x => x.x < g.x + 160 && x.x + x.w > g.x - GATE_LEAD));
      assert.ok(!course.obstacles.some(o => o.role === 'hazard' && o.x < g.x + 160 && o.x + o.w > g.x - GATE_LEAD));
      const s = gateStatement(g);
      assert.equal(s.option === s.answer, g.truth);
      assert.deepEqual(gateFor(course, `${stage}/${variant}/2026-11-24`), g);
    }
});

test('the combo builds on starlight and near misses, multiplies, and breaks on a hit', () => {
  assert.equal(comboMultiplier(9), 1);
  assert.equal(comboMultiplier(10), 1.5);
  assert.equal(comboMultiplier(25), 2);
  assert.equal(comboMultiplier(50), 3);
  const r = new Runner('beach');
  r.state = 'playing';
  const stars = r.course.items.filter(i => i.kind === 'star').slice(0, 12);
  stars.forEach(i => r.collect(i));
  assert.equal(r.combo, 12);
  // Ten stars at 10, then two at 15.
  assert.equal(r.comboPoints, 9 * 10 + 3 * 15);
  r.hurt();
  assert.equal(r.combo, 0);
  assert.equal(r.bestCombo, 12);
  // The island score is the plain one.
  assert.equal(r.points, Math.floor(r.maxDistance / 10) + 12 * 10);
});

test('blessings: Athena starts with the shield, Hermes jumps higher in the air, Poseidon saves one fall', () => {
  assert.deepEqual(BLESSING_IDS, ['none', 'athena', 'hermes', 'poseidon']);
  const a = new Runner('beach');
  a.bless('athena');
  assert.ok(a.shield);
  const strict = new Runner('beach', 'maps', 'classic', undefined, 'no-shield');
  strict.bless('athena');
  assert.ok(!strict.shield);
  const airJump = (id: 'none' | 'hermes') => {
    const r = new Runner('beach');
    r.bless(id);
    r.state = 'playing';
    r.jump();
    r.tick();
    for (let i = 0; i < 10; i++) r.tick();
    r.jump();
    r.tick();
    return r.vy;
  };
  assert.ok(airJump('hermes') < airJump('none'));
  const p = new Runner('beach');
  p.bless('poseidon');
  p.state = 'playing';
  p.hurt(true);
  assert.equal(p.hp, 3);
  assert.equal(p.events.at(-1)?.kind, 'rescue');
  p.hurt(true);
  assert.equal(p.hp, 2);
});

test('the gate reads O from a jump and X from running on, and right answers give the shield', () => {
  const run = (jump: boolean, truth: boolean) => {
    const r = new Runner('beach');
    const g = gateFor(r.course, 'test')!;
    r.gate = {...g, truth};
    r.state = 'playing';
    r.x = g.x - 60;
    r.prevX = r.x;
    for (let i = 0; i < 30 && r.gateSaid === null; i++) {
      if (jump && i === 0) r.jump();
      r.tick();
    }
    return r;
  };
  const yes = run(true, true);
  assert.equal(yes.gateSaid, true);
  assert.equal(yes.gateRight, true);
  assert.ok(yes.shield);
  const no = run(false, true);
  assert.equal(no.gateSaid, false);
  assert.equal(no.gateRight, false);
  assert.ok(!no.shield);
  assert.equal(run(false, false).gateRight, true);
});

test('the chest is found by jumping on its plank and the record keeps chests, combos and gates', () => {
  const r = new Runner('beach'),
    t = treasureFor(r.course)!;
  r.treasure = t;
  r.state = 'playing';
  const plank = r.course.platforms.find(p => Math.abs(p.x + p.w / 2 - 18 - t.x) < 1)!;
  r.x = plank.x + plank.w / 2 - 70;
  r.y = plank.y;
  r.grounded = true;
  r.jump();
  for (let i = 0; i < 40 && !r.treasureFound; i++) r.tick();
  assert.ok(r.treasureFound);
  const play = emptyPlay();
  playRun(play, 'beach', {
    combo: 12,
    comboPoints: 300,
    blessing: 'none',
    treasure: t.id,
    gate: {quiz: 'home', right: true},
  });
  playRun(play, 'beach', {combo: 5, comboPoints: 100, blessing: 'none', treasure: t.id});
  assert.deepEqual(play, {combos: {beach: {best: 12, points: 300}}, treasures: ['beach/classic'], gates: 1});
  assert.deepEqual(readPlay(JSON.parse(JSON.stringify(play))), play);
  assert.throws(() => readPlay({combos: {}, treasures: ['nowhere/classic'], gates: 0}));
  assert.throws(() => readPlay({combos: {beach: {best: -1, points: 0}}, treasures: [], gates: 0}));
  assert.deepEqual(readPlay(undefined), emptyPlay());
  const other = {
    combos: {beach: {best: 20, points: 90}, cave: {best: 3, points: 30}},
    treasures: ['cave/classic'],
    gates: 4,
  };
  assert.deepEqual(mergePlay(play, other), {
    combos: {beach: {best: 20, points: 300}, cave: {best: 3, points: 30}},
    treasures: ['beach/classic', 'cave/classic'],
    gates: 4,
  });
  // Through a run record: a right gate also counts as a myth question this week.
  const save = recordRun(
    emptySave(),
    {
      stage: 'beach',
      complete: false,
      score: 100,
      rating: 0,
      stars: 0,
      maps: [],
      hpLoss: 3,
      distance: 1000,
      extras: {combo: 4, comboPoints: 40, blessing: 'hermes', gate: {quiz: 'home', right: true}},
    },
    '2026-11-24',
    {special: false, weather: false},
  );
  assert.equal(save.play.gates, 1);
  assert.equal(save.weekly.counts.quiz, 1);
  assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save))).play, save.play);
});

test('boss runs keep no extras of their own and the oracle days hold a gift all run', () => {
  assert.ok(BOSS_COURSES.beach.mode === 'boss');
  const m = new Runner('beach', 'maps', 'classic', undefined, 'magnet');
  m.state = 'playing';
  for (let i = 0; i < 600; i++) m.tick();
  assert.ok(m.magnet > 0);
  const l = new Runner('beach', 'maps', 'classic', undefined, 'lantern');
  l.state = 'playing';
  for (let i = 0; i < 600; i++) l.tick();
  assert.ok(l.lantern > 0);
  const base = {
    stage: 'beach' as const,
    complete: true,
    score: 4000,
    rating: 2,
    stars: 79,
    maps: [],
    hpLoss: 1,
    distance: 24000,
  };
  assert.equal(dailyPassed({...dailySpec(), rule: 'magnet'}, base), false);
  assert.equal(dailyPassed({...dailySpec(), rule: 'magnet'}, {...base, stars: 80}), true);
  assert.equal(dailyPassed({...dailySpec(), rule: 'lantern'}, base), false);
  assert.equal(dailyPassed({...dailySpec(), rule: 'lantern'}, {...base, hpLoss: 0}), true);
});
