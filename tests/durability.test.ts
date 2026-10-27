import test from 'node:test';
import assert from 'node:assert/strict';
import {backupAge, backupReminder, markBackup} from '../src/storage/durability';

const memory = () => {
  const m = new Map<string, string>();
  return {getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v)};
};
const DAY = 86_400_000;

test('backup age counts whole days since the last whole-class backup', () => {
  const s = memory();
  assert.equal(backupAge(s, 10 * DAY), null);
  markBackup(s, 10 * DAY);
  assert.equal(backupAge(s, 10 * DAY + 5), 0);
  assert.equal(backupAge(s, 13.5 * DAY), 3);
});

test('class devices are reminded when the backup is old or missing, at most once a week', () => {
  const s = memory();
  assert.equal(backupReminder(s, false, 100 * DAY), null);
  assert.match(backupReminder(s, true, 100 * DAY)!, /백업 파일을 만들어/);
  assert.equal(backupReminder(s, true, 103 * DAY), null);
  markBackup(s, 104 * DAY);
  assert.equal(backupReminder(s, true, 110 * DAY), null);
  assert.match(backupReminder(s, true, 120 * DAY)!, /16일이 지났어요/);
});
