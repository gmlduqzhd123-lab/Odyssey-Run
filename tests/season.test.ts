import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave, validateSave, type RunResult} from '../src/storage/save';
import {recordQuiz, recordRun} from '../src/storage/feats';
import {
  SEASON_GOALS,
  mergeSeason,
  readSeason,
  seasonCount,
  seasonGoals,
  seasonMet,
  titleFor,
} from '../src/storage/season';
import {STAGES} from '../src/levels/courses';
import {QUIZ} from '../src/levels/quiz';
import {C} from '../src/config';

const run = (stage: RunResult['stage'], extra: Partial<RunResult> = {}): RunResult => ({
  stage,
  complete: true,
  score: 3000,
  rating: 3,
  stars: 90,
  maps: [],
  hpLoss: 0,
  distance: C.length,
  ...extra,
});

test('every month has four season goals, the same for everyone, and its own title', () => {
  const a = seasonGoals('2026-11');
  assert.equal(a.length, 4);
  assert.equal(new Set(a).size, 4);
  assert.deepEqual(seasonGoals('2026-11'), a);
  const months = Array.from(
    {length: 24},
    (_, i) => `${2026 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
  );
  assert.ok(new Set(months.map(m => seasonGoals(m).join())).size > 3, 'goals change from month to month');
  assert.equal(titleFor('2026-11'), '이타카의 수호자');
  assert.equal(titleFor('2027-01'), '새해의 항해사');
});

test('runs and quiz answers count toward this month, a new month starts fresh, and meeting all four wins the title', () => {
  let s = emptySave();
  const month = '2026-11',
    goals = seasonGoals(month);
  // Enough of everything for any four goals: every island, many clean runs, quiz answers and days.
  for (let d = 1; d <= 10; d++)
    for (const stage of STAGES)
      s = recordRun(s, run(stage), `2026-11-${String(d).padStart(2, '0')}`, {special: false, weather: false});
  const right = QUIZ.slice(0, 20);
  for (const q of right) s = recordQuiz(s, q.id, q.answer, '2026-11-12');
  for (const id of goals) assert.ok(seasonCount(s, id, month) >= SEASON_GOALS[id].target, id);
  assert.ok(seasonMet(s, month));
  assert.deepEqual(s.season.won, ['2026-11']);
  assert.equal(seasonCount(s, 'islands', month), STAGES.length);
  // A run in December starts December's counters; November's title stays.
  s = recordRun(s, run('beach', {hpLoss: 1}), '2026-12-01', {special: false, weather: false});
  assert.equal(s.season.month, '2026-12');
  assert.equal(seasonCount(s, 'runs', '2026-12'), 1);
  assert.equal(seasonCount(s, 'clean', '2026-12'), 0);
  assert.deepEqual(s.season.won, ['2026-11']);
  // The season survives the save check, and old saves without one get an empty season.
  assert.deepEqual(validateSave(structuredClone(s)).season, s.season);
  const old = structuredClone(s) as Partial<typeof s>;
  delete old.season;
  assert.deepEqual(validateSave(old).season, {month: '', counts: {}, islands: [], won: []});
});

test('stored seasons are checked, and two copies of a sailor merge without losing a title', () => {
  assert.throws(() => readSeason({month: '2026-13', counts: {}, islands: [], won: []}), /시즌/);
  assert.throws(() => readSeason({month: '2026-11', counts: {runs: -1}, islands: [], won: []}), /시즌/);
  assert.throws(() => readSeason({month: '2026-11', counts: {days: 3}, islands: [], won: []}), /시즌/);
  assert.throws(() => readSeason({month: '2026-11', counts: {}, islands: ['atlantis'], won: []}), /시즌/);
  assert.throws(() => readSeason({month: '2026-11', counts: {}, islands: [], won: ['2026-10', '2026-10']}), /시즌/);
  const a = {month: '2026-11', counts: {runs: 5, stars: 100}, islands: ['beach' as const], won: ['2026-09']},
    b = {month: '2026-11', counts: {runs: 3, quiz: 4}, islands: ['cave' as const], won: ['2026-10']};
  assert.deepEqual(mergeSeason(a, b), {
    month: '2026-11',
    counts: {runs: 5, stars: 100, quiz: 4},
    islands: ['beach', 'cave'],
    won: ['2026-09', '2026-10'],
  });
  const later = {month: '2026-12', counts: {runs: 1}, islands: [], won: []};
  assert.deepEqual(mergeSeason(a, later), {month: '2026-12', counts: {runs: 1}, islands: [], won: ['2026-09']});
});
