import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave, mergeResult, validateSave, type RunResult} from '../src/storage/save';
import {mergeSaves} from '../src/storage/merge';
import {ACHIEVEMENTS, WEEKLY_TASKS, recordQuiz, recordRun, streaks, weekKey, weeklyTasks} from '../src/storage/feats';

const run = (over: Partial<RunResult> = {}): RunResult => ({
  stage: 'beach',
  variant: 'classic',
  complete: true,
  score: 3600,
  rating: 2,
  stars: 80,
  maps: ['beach-map-1'],
  hpLoss: 0,
  distance: 24000,
  ...over,
});

test('ISO weeks and the same three weekly challenges for everyone that week', () => {
  assert.equal(weekKey('2026-11-01'), '2026-W44');
  assert.equal(weekKey('2026-11-02'), '2026-W45');
  assert.equal(weekKey('2027-01-01'), '2026-W53');
  const a = weeklyTasks('2026-W45');
  assert.equal(a.length, 3);
  assert.equal(new Set(a).size, 3);
  assert.deepEqual(weeklyTasks('2026-W45'), a);
  for (const id of a) assert.ok(Object.hasOwn(WEEKLY_TASKS, id));
});

test('runs and quiz answers fill the calendar and this week, and finishing all three is counted once', () => {
  let s = emptySave();
  const date = '2026-11-02',
    tasks = weeklyTasks(weekKey(date));
  s = mergeResult(s, run());
  s = recordRun(s, run(), date, {special: false, weather: false});
  assert.deepEqual(s.days, [date]);
  assert.equal(s.weekly.week, '2026-W45');
  assert.equal(s.weekly.counts.runs, 1);
  assert.equal(s.weekly.counts.stars, 80);
  assert.equal(s.weekly.counts.clean, 1);
  s = recordQuiz(s, 'home', 0, '2026-11-03');
  s = recordQuiz(s, 'home', 1, '2026-11-03');
  assert.deepEqual(s.quizPicks.home, [1, 1, 0]);
  assert.equal(s.weekly.counts.quiz, 1);
  assert.deepEqual(s.days, ['2026-11-02', '2026-11-03']);
  // Meet every challenge of the week.
  for (let i = 0; i < 6; i++)
    s = recordRun(
      s,
      run({
        adventure: {
          stamps: [],
          stories: [],
          constellations: [],
          combos: [],
          routes: [],
          nearMisses: 0,
          evaded: 4,
          tricked: 0,
          ghost: {score: 3600, duration: 75, samples: [0]},
        },
      }),
      date,
      {special: true, weather: true},
    );
  for (let i = 0; i < 3; i++) s = recordQuiz(s, 'home', 0, date);
  for (const t of tasks) assert.ok((s.weekly.counts[t] ?? 0) >= WEEKLY_TASKS[t].target, t);
  assert.equal(s.weekly.claimed, true);
  assert.equal(s.weekly.done, 1);
  s = recordRun(s, run(), date, {special: false, weather: false});
  assert.equal(s.weekly.done, 1);
  // A new week starts fresh but keeps the count of finished weeks.
  s = recordRun(s, run(), '2026-11-09', {special: false, weather: false});
  assert.equal(s.weekly.week, '2026-W46');
  assert.equal(s.weekly.claimed, false);
  assert.equal(s.weekly.done, 1);
  assert.deepEqual(validateSave(s), s);
});

test('streaks, badges and merging two copies keep the best of both', () => {
  assert.deepEqual(streaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'], '2026-10-06'), {
    best: 3,
    current: 1,
  });
  assert.deepEqual(streaks(['2026-10-05', '2026-10-06'], '2026-10-06'), {best: 2, current: 2});
  const s = emptySave();
  assert.deepEqual(
    ACHIEVEMENTS.filter(a => a.done(s)),
    [],
  );
  const played = recordRun(mergeResult(s, run()), run(), '2026-11-02', {special: false, weather: false});
  assert.ok(ACHIEVEMENTS.find(a => a.id === 'first')!.done(played));
  const other = recordQuiz(structuredClone(played), 'home', 2, '2026-11-04');
  other.savedAt = new Date(Date.parse(played.savedAt) + 1000).toISOString();
  const merged = mergeSaves(played, other);
  assert.deepEqual(merged.days, ['2026-11-02', '2026-11-04']);
  assert.deepEqual(merged.quizPicks.home, [0, 0, 1]);
  assert.equal(merged.weekly.counts.runs, 1);
  // Unknown weekly counters and malformed days are refused.
  assert.throws(() => validateSave({...played, days: ['2026-13-40x']}), /달력/);
  assert.throws(() => validateSave({...played, weekly: {...played.weekly, counts: {gold: 1}}}), /주간/);
  assert.throws(() => validateSave({...played, quizPicks: {home: [1, 2]}}), /퀴즈/);
  // Saves from before keep loading with an empty calendar.
  const old = structuredClone(played) as unknown as Record<string, unknown>;
  delete old.days;
  delete old.weekly;
  delete old.quizPicks;
  const back = validateSave(old);
  assert.deepEqual(back.days, []);
  assert.equal(back.weekly.done, 0);
});
