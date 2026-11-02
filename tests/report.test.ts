import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave} from '../src/storage/save';
import {progress} from '../src/storage/profiles';
import {weeklyActivity, REPORT_WEEKS} from '../src/ui/report-view';

test('weekly activity counts each sailor once per week over the last weeks', () => {
  const a = emptySave(),
    b = emptySave();
  a.days = ['2026-10-20', '2026-10-21', '2026-11-02'];
  b.days = ['2026-11-03'];
  const rows = [
    {id: 'a', name: '가', ...progress(a)},
    {id: 'b', name: '나', ...progress(b)},
  ];
  const weeks = weeklyActivity(rows, '2026-11-04');
  assert.equal(weeks.length, REPORT_WEEKS);
  assert.equal(weeks.at(-1)!.week, '2026-W45');
  assert.deepEqual(weeks.at(-1), {week: '2026-W45', sailors: 2, days: 2});
  assert.deepEqual(weeks.at(-3), {week: '2026-W43', sailors: 1, days: 2});
  assert.equal(weeks.at(-2)!.sailors, 0);
});
