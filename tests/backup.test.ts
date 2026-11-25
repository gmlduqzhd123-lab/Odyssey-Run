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
  assert.deepEqual(r, {merged: 1, added: 1, skipped: 0, contests: 1, gallery: 0});
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
test('a class backup carries the device settings: teams, lesson preset and fleet goal', async () => {
  const {TEAMS_KEY, FLEET_KEY, readClassDevice} = await import('../src/storage/class-device');
  const {PRESET_KEY} = await import('../src/storage/lesson-preset');
  const m = classroom();
  m.setItem(TEAMS_KEY, JSON.stringify({jiwoo01: 'B', gone: 'Z'}));
  m.setItem(PRESET_KEY, 'easy');
  m.setItem(FLEET_KEY, '500');
  const backup = readClassBackup(JSON.parse(JSON.stringify(classBackup(m))));
  assert.deepEqual(backup.device, {teams: {jiwoo01: 'B'}, preset: 'easy', fleetGoal: 500});
  const fresh = new Memory();
  restoreClass(fresh, backup);
  assert.deepEqual(readClassDevice(fresh), {teams: {jiwoo01: 'B'}, preset: 'easy', fleetGoal: 500});
  // What a device already has stays.
  const other = new Memory();
  other.setItem(TEAMS_KEY, JSON.stringify({jiwoo01: 'C'}));
  other.setItem(FLEET_KEY, '900');
  restoreClass(other, backup);
  assert.deepEqual(readClassDevice(other), {teams: {jiwoo01: 'C'}, preset: 'easy', fleetGoal: 900});
  // Older backups have no device part.
  const old = JSON.parse(JSON.stringify(classBackup(classroom())));
  delete old.device;
  assert.deepEqual(readClassBackup(old).device, {teams: {}, preset: null, fleetGoal: null});
});
test('the prologue flag is read leniently and merged', async () => {
  const {readPlay, mergePlay, emptyPlay} = await import('../src/storage/play');
  const p = readPlay({combos: {}, treasures: [], gates: 0});
  assert.equal(p.prologue, false);
  assert.equal(readPlay({...p, prologue: true}).prologue, true);
  assert.throws(() => readPlay({...p, prologue: 'yes'}));
  assert.equal(mergePlay(emptyPlay(), {...emptyPlay(), prologue: true}).prologue, true);
});
