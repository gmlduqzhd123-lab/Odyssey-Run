import test from 'node:test';
import assert from 'node:assert/strict';
import {classBackup, readClassBackup, restoreClass} from '../src/storage/backup';
import {Profiles, profileKey, MAIN_PROFILE} from '../src/storage/profiles';
import {Contests} from '../src/storage/contests';
import {SaveStore, mergeResult, type RunResult} from '../src/storage/save';

class Memory {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}
const win = (score: number): RunResult => ({
  stage: 'beach',
  complete: true,
  score,
  rating: 1,
  stars: 0,
  maps: [],
  hpLoss: 1,
  distance: 24000,
});
function classroom() {
  const m = new Memory(),
    p = new Profiles(m),
    id = p.add('지우', 'jiwoo01');
  const s = new SaveStore(m, profileKey(id));
  s.data = mergeResult(s.data, win(3200));
  s.persist();
  const c = new Contests(m);
  c.host({id: 'abc234', title: '3반', stage: 'beach', variant: 'classic', assist: false});
  c.add({
    kind: 'result',
    contest: 'abc234',
    name: '지우',
    score: 3200,
    complete: true,
    stars: 0,
    maps: 0,
    hpLoss: 1,
    time: 80,
  });
  return m;
}

test('a class backup round-trips through JSON and restores onto an empty device', () => {
  const file = JSON.parse(JSON.stringify(classBackup(classroom())));
  const backup = readClassBackup(file),
    fresh = new Memory();
  const r = restoreClass(fresh, backup);
  assert.deepEqual(r, {merged: 1, added: 1, skipped: 0, contests: 1});
  const list = new Profiles(fresh).book.list;
  assert.deepEqual(
    list.map(p => p.name),
    ['첫 항해사', '지우'],
  );
  assert.equal(new SaveStore(fresh, profileKey('jiwoo01')).data.stages.beach.bestScore, 3200);
  assert.equal(new Contests(fresh).find('abc234')!.entries.length, 1);
});

test('restoring merges with what is already on the device and never lowers a record', () => {
  const device = classroom(),
    local = new SaveStore(device, profileKey('jiwoo01'));
  local.data = mergeResult(local.data, win(3900));
  local.persist();
  const older = readClassBackup(JSON.parse(JSON.stringify(classBackup(classroom()))));
  restoreClass(device, older);
  assert.equal(new SaveStore(device, profileKey('jiwoo01')).data.stages.beach.bestScore, 3900);
  assert.equal(new Profiles(device).book.list.length, 2, 'same sailor merged, not duplicated');
  assert.equal(new Profiles(device).active.id, 'jiwoo01');
  assert.ok(new Profiles(device).book.list.some(p => p.id === MAIN_PROFILE));
});

test('class backups reject other files and invalid sailor records', () => {
  assert.throws(() => readClassBackup({kind: 'something'}), /반 전체 백업/);
  const b = JSON.parse(JSON.stringify(classBackup(classroom())));
  b.saves.jiwoo01.stages.beach.bestScore = 999999;
  assert.throws(() => readClassBackup(b), /지우/);
});
test('record files are size-checked before they are read as JSON', async () => {
  const {readJsonFile} = await import('../src/storage/json-file');
  assert.deepEqual(await readJsonFile(new Blob(['{"a":1}']), 100, 'big'), {a: 1});
  await assert.rejects(readJsonFile(new Blob(['x'.repeat(200)]), 100, 'big'), /big/);
  await assert.rejects(readJsonFile(new Blob(['{nope']), 100, 'big'), /JSON 파일을 읽을 수 없어요/);
});
