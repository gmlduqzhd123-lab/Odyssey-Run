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

test('storage use counts the game keys, and only superseded restore copies are tidied', async () => {
  const {storageUse, spareCopies, dropSpareCopies} = await import('../src/storage/durability');
  const {SAVE_KEY, emptySave} = await import('../src/storage/save');
  const m = new Map<string, string>(),
    s = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      key: (i: number) => [...m.keys()][i] ?? null,
      get length() {
        return m.size;
      },
    };
  const good = JSON.stringify(emptySave());
  s.setItem(SAVE_KEY, good);
  s.setItem(SAVE_KEY + ':backup', good);
  s.setItem(SAVE_KEY + ':p:abc123', '{broken');
  s.setItem(SAVE_KEY + ':p:abc123:backup', good);
  s.setItem('other-app', 'x'.repeat(1000));
  assert.equal(
    storageUse(s),
    [...m].filter(([k]) => k.startsWith('odyssey-run:')).reduce((n, [k, v]) => n + (k + v).length * 2, 0),
  );
  assert.deepEqual(spareCopies(s), [SAVE_KEY + ':backup']);
  assert.equal(dropSpareCopies(s), 1);
  assert.ok(m.has(SAVE_KEY + ':p:abc123:backup'), 'a damaged save keeps its original copy');
  assert.ok(m.has('other-app'));
});
