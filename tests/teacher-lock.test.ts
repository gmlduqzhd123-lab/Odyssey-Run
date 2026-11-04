import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPin, guarded, lessonOpen, makeLock, readLock} from '../src/storage/teacher-lock';

test('the teacher lock keeps a salted hash, checks the PIN and rejects bad stored data', async () => {
  await assert.rejects(() => makeLock('12'), /4~8자리/);
  await assert.rejects(() => makeLock('12ab'), /4~8자리/);
  const lock = await makeLock('2468');
  assert.match(lock.salt, /^[0-9a-f]{32}$/);
  assert.match(lock.hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(lock).includes('2468'));
  assert.ok(await checkPin(lock, '2468'));
  assert.ok(!(await checkPin(lock, '2469')));
  assert.ok(!(await checkPin(lock, '')));
  // A second lock of the same PIN gets its own salt.
  assert.notEqual((await makeLock('2468')).hash, lock.hash);
  // Stored data is read back, and anything malformed means no lock.
  assert.deepEqual(readLock(JSON.stringify(lock)), lock);
  assert.equal(readLock('{"salt":"x","hash":"y"}'), null);
  assert.equal(readLock('not json'), null);
  assert.equal(readLock(null), null);
  const lesson = readLock(JSON.stringify({...lock, lesson: ['beach', 'nowhere', 'cave', 'beach']}))!;
  assert.deepEqual(lesson.lesson, ['beach', 'cave']);
  assert.equal(readLock(JSON.stringify({...lock, lesson: []}))!.lesson, null);
});

test('only actions that delete or replace records need the PIN, and a lesson opens chosen islands', async () => {
  for (const a of [
    'reset-confirm',
    'import-confirm',
    'class-import-confirm',
    'storage-tidy',
    'contest-delete:abc123',
    'contest-clear:abc123',
    'contest-drop:abc123/%EC%A7%80',
    'gallery-remove:3',
    'profile-delete:p2',
    'profile-delete-confirm',
    'lock-off',
    'lesson-save',
  ])
    assert.ok(guarded(a), a);
  for (const a of ['start', 'islands', 'settings', 'class-export', 'export', 'contest-open:abc123', 'profile-use:p2'])
    assert.ok(!guarded(a), a);
  const lock = {...(await makeLock('2468')), lesson: ['beach' as const]};
  assert.ok(lessonOpen(lock, 'beach'));
  assert.ok(!lessonOpen(lock, 'cave'));
  assert.ok(lessonOpen(null, 'cave'));
  assert.ok(lessonOpen({...lock, lesson: null}, 'cave'));
});
