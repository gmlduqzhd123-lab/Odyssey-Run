import test from 'node:test';
import assert from 'node:assert/strict';
import {Contests, CONTESTS_KEY, readContests, rank, newContestId, leaderOf, MAX_ENTRIES} from '../src/storage/contests';
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

test('contest results whose parts cannot add up are flagged, real runs are not', async () => {
  const {suspicion} = await import('../src/storage/contests');
  const real = {
    name: '하린',
    score: 2400 + 80 * 10 + 2 * 100 + 500,
    complete: true,
    stars: 80,
    maps: 2,
    hpLoss: 0,
    time: 77.5,
  };
  assert.equal(suspicion(real), null);
  assert.equal(suspicion({...real, complete: false, score: 1200 + 300, stars: 30, time: 40}), null);
  assert.match(suspicion({...real, score: 4200})!, /맞지 않아요/);
  assert.match(suspicion({...real, score: 2000 + 800 + 200 + 500})!, /모자라요/);
  assert.match(suspicion({...real, time: 30})!, /너무 길어요/);
});

test('a teacher can drop one sailor from a board', async () => {
  const {Contests} = await import('../src/storage/contests');
  const m = new Map<string, string>(),
    c = new Contests({getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v)});
  c.host({id: 'drop01', title: '빼기', stage: 'beach', variant: 'classic', assist: false});
  for (const name of ['가', '나'])
    c.add({
      kind: 'result',
      contest: 'drop01',
      name,
      score: 100,
      complete: false,
      stars: 0,
      maps: 0,
      hpLoss: 0,
      time: 40,
    });
  c.drop('drop01', '가');
  assert.deepEqual(
    c.find('drop01')!.entries.map(e => e.name),
    ['나'],
  );
});

test('the board keeps ghosts only for the top three and names the best one with a ghost as the leader', () => {
  const m = new Memory(),
    c = new Contests(m),
    ghost = (score: number) => ({
      score,
      duration: 80,
      samples: Array.from({length: 81}, (_, i) => Math.min(24000, i * 300)),
    });
  c.host({id: 'abc234', title: '대회', stage: 'beach', variant: 'classic', assist: false});
  assert.equal(leaderOf(c.find('abc234')!), null);
  for (let i = 0; i < 6; i++) c.add(result(`항해사${i}`, 1000 + i * 100, {ghost: ghost(1000 + i * 100)}));
  const board = c.find('abc234')!;
  assert.deepEqual(
    board.entries
      .filter(e => e.ghost)
      .map(e => e.name)
      .sort(),
    ['항해사3', '항해사4', '항해사5'],
  );
  assert.equal(leaderOf(board)!.name, '항해사5');
  // A new best without a ghost (an older client) still ranks first; the leader is the best run with a ghost.
  c.add(result('무영', 2000));
  assert.equal(rank(c.find('abc234')!.entries)[0].name, '무영');
  assert.equal(leaderOf(c.find('abc234')!)!.name, '항해사5');
  // Stored ghosts are validated on reload.
  const stored = JSON.parse(m.getItem(CONTESTS_KEY)!);
  stored.hosted[0].entries[0].ghost = {score: 1, duration: 'x', samples: 'nope'};
  m.setItem(CONTESTS_KEY, JSON.stringify(stored));
  const again = new Contests(m).find('abc234')!;
  assert.ok(again.entries.every(e => !e.ghost || Array.isArray(e.ghost.samples)));
});
test('the race-the-leader link carries the best run that has a ghost and changes when the leader does', async () => {
  const {joinLink, raceMarkup} = await import('../src/ui/contest-view');
  const {decodeLink} = await import('../src/systems/share');
  const m = new Memory(),
    c = new Contests(m),
    ghost = (score: number) => ({
      score,
      duration: 80,
      samples: Array.from({length: 81}, (_, i) => Math.min(24000, i * 300)),
    }),
    code = (url: string) => url.split('#c=')[1];
  c.host({id: 'abc234', title: '대회', stage: 'beach', variant: 'classic', assist: false});
  const board = () => c.find('abc234')!;
  assert.equal(joinLink(board(), 'https://x.test/', true), '');
  assert.equal(raceMarkup(board(), 'https://x.test/'), '');
  assert.match(code(joinLink(board(), 'https://x.test/')), /^c1\./);
  c.add(result('가람', 1200, {ghost: ghost(1200)}));
  const first = decodeLink(code(joinLink(board(), 'https://x.test/', true)));
  assert.equal(first.kind === 'contest' && first.leader?.name, '가람');
  assert.match(raceMarkup(board(), 'https://x.test/'), /가람/);
  c.add(result('나래', 2500, {ghost: ghost(2500)}));
  const second = decodeLink(code(joinLink(board(), 'https://x.test/', true)));
  assert.equal(second.kind === 'contest' && second.leader?.name, '나래');
  // A board that only collects results (no course) has no join or race link.
  c.add({...result('다온', 900), contest: 'zzz999'});
  assert.equal(joinLink(c.find('zzz999')!, 'https://x.test/', true), '');
});
