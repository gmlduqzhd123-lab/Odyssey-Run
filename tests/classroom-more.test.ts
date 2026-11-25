import test from 'node:test';
import assert from 'node:assert/strict';
import {C} from '../src/config';
import {Runner} from '../src/player/runner';
import {BOSS_COURSES, bossWeakPoints} from '../src/levels/bosses';
import {STAGES} from '../src/levels/courses';
import {buildCustom, checkCustom, isBlocks} from '../src/levels/maker';
import {prologueCourse, prologueGuide, PROLOGUE_BLOCKS} from '../src/levels/prologue';
import {READINGS} from '../src/levels/readings';
import {quizIds} from '../src/levels/quiz';
import {answered, emptyPlay, keepWeek, mergePlay, readPlay} from '../src/storage/play';
import {cardsDone, newCardGame, turnCard} from '../src/ui/word-cards';
import {PRESETS, readPreset, writePreset} from '../src/storage/lesson-preset';
import {readLive, readTeams, teamStars} from '../src/ui/class-view';
import {addNote, clearNotes, readNotes} from '../src/ui/translation-report';
import {HEROES} from '../src/systems/heroes';
import {guarded} from '../src/storage/teacher-lock';

const memory = () => {
  const box = new Map<string, string>();
  return {
    getItem: (k: string) => box.get(k) ?? null,
    setItem: (k: string, v: string) => void box.set(k, v),
    removeItem: (k: string) => void box.delete(k),
  };
};

test('each boss has three weak points between its attacks, reached by a jump and not by running', () => {
  for (const stage of STAGES) {
    const points = bossWeakPoints(stage),
      e = BOSS_COURSES[stage].enemies;
    assert.equal(points.length, 3);
    points.forEach((p, i) => {
      assert.ok(p.x > e[i * 2].x && p.x < e[i * 2 + 1].x, `${stage} point ${i}`);
      // A standing hero's head is at 376; the point's box starts at 276 and ends at 324.
      assert.ok(p.y + 24 < C.ground - C.stand);
    });
  }
  const r = new Runner('beach', 'maps', 'classic', BOSS_COURSES.beach);
  r.weakPoints = bossWeakPoints('beach');
  r.state = 'playing';
  r.x = r.prevX = r.weakPoints[0].x - 120;
  r.jump();
  for (let i = 0; i < 40 && !r.weakHits.size; i++) r.tick();
  assert.equal(r.weakHits.size, 1);
  assert.equal(r.bossHp, 2);
});

test('hero abilities hold on ordinary runs only', () => {
  assert.ok(HEROES.every(h => h.ability));
  const a = new Runner('beach');
  a.extras = true;
  a.hero = 'athena';
  a.state = 'playing';
  a.collect(a.course.items.find(i => i.kind === 'shield')!);
  a.hurt();
  assert.ok(a.shield, 'first block keeps the shield');
  a.invincible = 0;
  a.hurt();
  assert.ok(!a.shield);
  assert.equal(a.hp, 3);
  const plain = new Runner('beach');
  plain.hero = 'athena';
  plain.state = 'playing';
  plain.collect(plain.course.items.find(i => i.kind === 'shield')!);
  plain.hurt();
  assert.ok(!plain.shield);
  const p = new Runner('beach');
  p.extras = true;
  p.hero = 'penelope';
  p.state = 'playing';
  p.missions = [{kind: 'clean', at: 100, goal: 1, seconds: 8}];
  p.x = p.prevX = 120;
  p.tick();
  assert.equal(p.mission?.seconds, 10);
  const airJump = (hero: string) => {
    const r = new Runner('beach');
    r.extras = true;
    r.hero = hero;
    r.state = 'playing';
    r.jump();
    r.tick();
    for (let i = 0; i < 10; i++) r.tick();
    r.jump();
    r.tick();
    return r.vy;
  };
  assert.ok(airJump('telemachus') < airJump('odysseus'));
});

test('the course maker has spring, rope, stone soldier and chase blocks, and the prologue can be finished', () => {
  assert.ok(isBlocks('fjrtefffff'));
  assert.ok(!isBlocks('fffffffffq'));
  const c = buildCustom('beach', 'fjrteeffff');
  assert.equal(c.springs?.length, 1);
  assert.equal(c.ropes?.length, 1);
  assert.ok(c.enemies.some(e => e.kind === 'stone'));
  assert.ok(c.chase && c.chase.end - c.chase.start === 2000);
  const r = new Runner('beach', 'maps', 'classic', c);
  assert.deepEqual(r.springs, c.springs);
  assert.ok(r.chase);
  assert.equal(PROLOGUE_BLOCKS.length, 10);
  assert.ok(checkCustom(prologueCourse()).ok);
  const guide = prologueGuide();
  assert.equal(guide.length, 10);
  assert.ok(guide.every((g, i) => i === 0 || g.x > guide[i - 1].x));
});

test('the wrong-answer notebook fills with misses and empties as they are answered right', () => {
  const play = emptyPlay();
  answered(play, quizIds[3], false);
  answered(play, quizIds[1], false);
  answered(play, quizIds[1], false);
  assert.deepEqual(play.missed, [quizIds[1], quizIds[3]]);
  answered(play, quizIds[1], true);
  assert.deepEqual(play.missed, [quizIds[3]]);
  assert.equal(play.mastered, 1);
  answered(play, 'nope', false);
  assert.deepEqual(play.missed, [quizIds[3]]);
  assert.deepEqual(readPlay(JSON.parse(JSON.stringify(play))), play);
  assert.throws(() => readPlay({...play, missed: ['nope']}));
  // Older saves without the new fields still load.
  assert.deepEqual(readPlay({combos: {}, treasures: [], gates: 0}), emptyPlay());
});

test('island readings: one per island, two questions with three options each', () => {
  assert.deepEqual(
    READINGS.map(r => r.id),
    [...STAGES],
  );
  for (const r of READINGS) {
    assert.equal(r.lines.length, 4);
    assert.equal(r.questions.length, 2);
    for (const q of r.questions) assert.ok(q.options[q.answer]);
  }
  const play = {...emptyPlay(), readings: ['beach']};
  assert.deepEqual(readPlay(JSON.parse(JSON.stringify(play))).readings, ['beach']);
  assert.throws(() => readPlay({...play, readings: ['mars']}));
});

test('word cards: a portrait and its name stay up, a miss turns back, the game ends when all match', () => {
  const g = newCardGame('seed');
  assert.equal(g.cards.length, 12);
  const pair = (person: string) => g.cards.flatMap((c, i) => (c.person === person ? [i] : []));
  const [a, b] = pair('odysseus'),
    other = pair('penelope')[0];
  turnCard(g, a);
  assert.equal(turnCard(g, other), 'miss');
  turnCard(g, a);
  assert.equal(turnCard(g, b), 'match');
  for (const person of ['penelope', 'telemachus', 'athena', 'hermes', 'aeolus']) {
    const [x, y] = pair(person);
    turnCard(g, x);
    turnCard(g, y);
  }
  assert.ok(cardsDone(g));
  assert.equal(g.turns, 7);
  assert.deepEqual(newCardGame('seed').cards, newCardGame('seed').cards);
});

test('weeks are kept for the growth report, merged by the larger counts', () => {
  const play = emptyPlay();
  keepWeek(play, {week: '2026-W46', counts: {runs: 3, stars: 120, quiz: 2}});
  keepWeek(play, {week: '2026-W46', counts: {runs: 9}});
  keepWeek(play, {week: '2026-W47', counts: {}});
  keepWeek(play, {week: '', counts: {runs: 1}});
  assert.deepEqual(play.weeks, [{week: '2026-W46', runs: 3, stars: 120, quiz: 2}]);
  const other = {...emptyPlay(), weeks: [{week: '2026-W46', runs: 5, stars: 10, quiz: 0}]};
  assert.deepEqual(mergePlay(play, other).weeks, [{week: '2026-W46', runs: 5, stars: 120, quiz: 2}]);
  assert.deepEqual(readPlay(JSON.parse(JSON.stringify(play))).weeks, play.weeks);
});

test('lesson presets, teams and translation notes are kept on the device and read safely', () => {
  const s = memory();
  assert.equal(readPreset(s), null);
  writePreset(s, 'easy');
  assert.equal(readPreset(s), 'easy');
  assert.equal(PRESETS.easy.assist.pace, 0.8);
  s.setItem(Object.keys(Object.fromEntries([['x', 1]]))[0], 'bad');
  writePreset(s, null);
  assert.equal(readPreset(s), null);
  assert.ok(guarded('preset:easy'));
  assert.deepEqual(readTeams('{"p1":"A","p2":"Z","p3":"B"}'), {p1: 'A', p3: 'B'});
  assert.deepEqual(
    teamStars(
      [
        {id: 'p1', stars: 10},
        {id: 'p2', stars: 5},
        {id: 'p3', stars: 7},
      ],
      {p1: 'A', p3: 'B'},
    ),
    {A: 10, B: 7},
  );
  const live = readLive(JSON.stringify({start: 1, minutes: 5, goal: 50, base: 0, teams: {A: 3, B: 4}}))!;
  assert.deepEqual(live.teams, {A: 3, B: 4});
  assert.equal(readLive(JSON.stringify({start: 1, minutes: 5, goal: 50, base: 0, teams: {A: 3}}))!.teams, undefined);
  addNote(s, {lang: 'vi', text: 'Bắt đầu', note: 'sai', screen: 'home'});
  assert.equal(readNotes(s).length, 1);
  assert.equal(readNotes(s)[0].note, 'sai');
  clearNotes(s);
  assert.deepEqual(readNotes(s), []);
});

test("Odysseus's ability adds combo points without changing the fever or the run", () => {
  const make = (hero: string) => {
    const r = new Runner('beach');
    r.extras = true;
    r.hero = hero;
    r.state = 'playing';
    for (const s of r.course.items.filter(i => i.kind === 'star').slice(0, 20)) r.collect(s);
    return r;
  };
  const o = make('odysseus'),
    p = make('penelope');
  assert.equal(o.feverGauge, p.feverGauge);
  assert.ok(o.comboPoints > p.comboPoints);
});
test('course balance counts runs, finishes, the stretch of each HP loss and its cause, only when on', async () => {
  const {addRun, readBalance, recordBalance, setBalanceOn, hardest, topKind, BALANCE_KEY, stretchOf} =
    await import('../src/storage/balance');
  const m = new Map<string, string>(),
    s = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  const run = {complete: false, distance: 12500, length: 24000, damage: [{kind: 'crab' as const, x: 5000, time: 3}]};
  recordBalance(s, 'beach/classic', run);
  assert.equal(m.get(BALANCE_KEY), undefined, 'off by default');
  setBalanceOn(s, true);
  recordBalance(s, 'beach/classic', run);
  recordBalance(s, 'beach/classic', {
    ...run,
    complete: true,
    distance: 24000,
    damage: [
      {kind: 'crab', x: 5100, time: 3},
      {kind: 'fall', x: 20000, time: 9},
    ],
  });
  const b = readBalance(m.get(BALANCE_KEY)!);
  assert.equal(b['beach/classic'].runs, 2);
  assert.equal(b['beach/classic'].done, 1);
  assert.equal(b['beach/classic'].ends[stretchOf(12500, 24000)], 1);
  assert.equal(hardest(b['beach/classic']), 2);
  assert.equal(topKind(b['beach/classic']), 'crab');
  // Damaged or hostile data is dropped, never trusted.
  assert.deepEqual(
    readBalance('{"x":{"runs":1},"beach/classic":{"runs":-1,"done":5,"hits":"no"}}')['beach/classic'].runs,
    0,
  );
  assert.deepEqual(readBalance('nope'), {});
  assert.equal(addRun({}, '../bad', run)['../bad'], undefined);
});
test('a live mission can count other devices through its contest', async () => {
  const {readLive, liveMarkup} = await import('../src/ui/class-view');
  const m = readLive(JSON.stringify({start: 1000, minutes: 10, goal: 100, base: 20, contest: 'abc234'}))!;
  assert.equal(m.contest, 'abc234');
  assert.equal(
    readLive(JSON.stringify({start: 1000, minutes: 10, goal: 100, base: 20, contest: '<b>'}))!.contest,
    undefined,
  );
  const html = liveMarkup(m, 50, 3, 2000, undefined, {stars: 45, sailors: 2});
  assert.ok(html.includes('별빛 75 / 100'), 'this device 30 + other devices 45');
  assert.ok(html.includes('contest-open:abc234'));
  assert.ok(liveMarkup(null, 0, 3, 0).includes('live-devices'));
});
test('the growth report marks weeks sailed before weekly counts were kept and compares only counted weeks', async () => {
  const {growthWeeks, growthMarkup} = await import('../src/ui/report-view');
  const r = {
    name: '지우',
    islands: 2,
    quiz: 3,
    readings: 1,
    missed: 0,
    prologue: true,
    days: ['2026-11-03', '2026-11-04', '2026-11-18', '2026-11-24'],
    weeks: [{week: '2026-W47', runs: 2, stars: 80, quiz: 1}],
    thisWeek: {week: '2026-W48', runs: 5, stars: 150, quiz: 2},
  } as unknown as Parameters<typeof growthWeeks>[0];
  const ws = growthWeeks(r, '2026-11-25');
  const early = ws.find(w => w.week === '2026-W45')!;
  assert.equal(early.tracked, false);
  assert.equal(early.days, 2);
  assert.equal(ws.find(w => w.week === '2026-W48')!.tracked, true);
  const html = growthMarkup('', [r], '2026-11-25');
  assert.ok(html.includes('class="estimate"'));
  assert.ok(html.includes('완주 ▲ 3'), 'from the first counted week (2) to this week (5)');
});
