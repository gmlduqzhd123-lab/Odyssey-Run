import test from 'node:test';
import assert from 'node:assert/strict';
import {Contests, CONTESTS_KEY, readContests, rank, newContestId, MAX_ENTRIES} from '../src/storage/contests';
import type {ContestResult} from '../src/systems/share';

class Memory {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}
const result = (name: string, score: number, extra: Partial<ContestResult> = {}): ContestResult => ({
  kind: 'result',
  contest: 'abc234',
  name,
  score,
  complete: score > 2900,
  stars: 50,
  maps: 1,
  hpLoss: 1,
  time: 80,
  ...extra,
});

test('a board keeps each name once with its best run and ranks by score, completion and fewer hits', () => {
  const m = new Memory(),
    c = new Contests(m);
  c.host({id: 'abc234', title: '3반', stage: 'cave', variant: 'remix-a', assist: false});
  c.add(result('지우', 3000));
  c.add(result('지우', 2500));
  c.add(result('민준', 3000, {hpLoss: 0}));
  c.add(result('서연', 1200));
  const board = new Contests(m).find('abc234')!;
  assert.equal(board.entries.length, 3);
  assert.deepEqual(
    rank(board.entries).map(e => [e.name, e.score]),
    [
      ['민준', 3000],
      ['지우', 3000],
      ['서연', 1200],
    ],
  );
  assert.equal(board.stage, 'cave');
});

test('results for a contest this device has not opened start a results-only board', () => {
  const c = new Contests(new Memory());
  const {contest, added} = c.add(result('하린', 900, {contest: 'zzz999'}));
  assert.ok(added);
  assert.equal(contest.stage, null);
  c.host({id: 'zzz999', title: '대회', stage: 'beach', variant: 'classic', assist: true});
  assert.equal(c.find('zzz999')!.entries.length, 1, 'opening the contest later keeps collected results');
});

test('boards cap entries, sailors keep a personal best, and stored data is sanitized', () => {
  const c = new Contests(new Memory());
  for (let i = 0; i < MAX_ENTRIES + 5; i++) c.add(result('p' + i, i));
  assert.equal(c.find('abc234')!.entries.length, MAX_ENTRIES);
  assert.equal(c.record('abc234', 'main', {...result('나', 100)}).score, 100);
  assert.equal(c.record('abc234', 'main', {...result('나', 50)}).score, 100);
  const dirty = readContests(
    JSON.stringify({
      hosted: [
        {id: 'BAD', title: 'x'},
        {
          id: 'abc234',
          title: '<b>',
          stage: 'atlantis',
          variant: 'x',
          entries: [
            {name: '', score: 1},
            {name: 'ok', score: 5, stars: 1, maps: 0, hpLoss: 0, time: 3},
          ],
        },
      ],
      best: {'bad key': {}},
    }),
  );
  assert.equal(dirty.hosted.length, 1);
  assert.equal(dirty.hosted[0].stage, null);
  assert.equal(dirty.hosted[0].entries.length, 1);
  assert.deepEqual(dirty.best, {});
  assert.deepEqual(readContests('{nope'), {hosted: [], best: {}});
  assert.match(newContestId(), /^[a-z0-9]{6}$/);
  assert.ok(CONTESTS_KEY.endsWith(':contests'));
});
