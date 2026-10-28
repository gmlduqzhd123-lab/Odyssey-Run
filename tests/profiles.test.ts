import test from 'node:test';
import assert from 'node:assert/strict';
import {Profiles, PROFILES_KEY, MAIN_PROFILE, profileKey, readBook, cleanName} from '../src/storage/profiles';
import {SaveStore, SAVE_KEY, emptySave, mergeResult} from '../src/storage/save';

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

test('the first profile keeps the original save key so existing records stay put', () => {
  const m = new Memory();
  const old = mergeResult(emptySave(), {
    stage: 'beach',
    complete: true,
    score: 3000,
    rating: 1,
    stars: 0,
    maps: [],
    hpLoss: 1,
    distance: 24000,
  });
  m.setItem(SAVE_KEY, JSON.stringify(old));
  const p = new Profiles(m);
  assert.equal(p.active.id, MAIN_PROFILE);
  assert.equal(profileKey(MAIN_PROFILE), SAVE_KEY);
  assert.equal(new SaveStore(m, profileKey(p.active.id)).data.stages.beach.bestScore, 3000);
});

test('profiles keep separate saves, rank on-device totals and protect the active and first profiles', () => {
  const m = new Memory(),
    p = new Profiles(m);
  const id = p.add('  지우  ', 'abc123');
  assert.equal(p.active.name, '지우');
  const store = new SaveStore(m, profileKey(id));
  store.data = mergeResult(store.data, {
    stage: 'beach',
    complete: true,
    score: 3500,
    rating: 2,
    stars: 80,
    maps: ['beach-map-1'],
    hpLoss: 0,
    distance: 24000,
  });
  store.persist();
  assert.equal(m.getItem(SAVE_KEY), null, 'first profile untouched');
  const board = new Profiles(m).board();
  assert.deepEqual(
    board.map(b => [b.name, b.total, b.islands, b.maps]),
    [
      ['지우', 3500, 1, 1],
      ['첫 항해사', 0, 0, 0],
    ],
  );
  assert.throws(() => p.add('지우'), /같은 이름/);
  assert.throws(() => p.add('   '));
  assert.throws(() => p.remove(id), /지울 수 없어요/);
  assert.throws(() => p.remove(MAIN_PROFILE));
  p.use(MAIN_PROFILE);
  p.remove(id);
  assert.equal(m.getItem(profileKey(id)), null);
  assert.deepEqual(
    new Profiles(m).book.list.map(x => x.id),
    [MAIN_PROFILE],
  );
});

test('profile books are sanitized and fall back to the first profile', () => {
  assert.equal(cleanName('a\u0000b<script>long-name'), 'ab<script>lo');
  assert.equal(readBook('{broken').active, MAIN_PROFILE);
  const book = readBook(
    JSON.stringify({
      active: 'zzz999',
      list: [
        {id: '../x', name: 'bad'},
        {id: 'abc123', name: ' ok '},
      ],
    }),
  );
  assert.deepEqual(
    book.list.map(p => p.id),
    [MAIN_PROFILE, 'abc123'],
  );
  assert.equal(book.active, MAIN_PROFILE);
  assert.equal(book.list[1].name, 'ok');
  assert.ok(PROFILES_KEY.startsWith(SAVE_KEY));
});

test('the teacher progress table lists every sailor with each island and exports as CSV', async () => {
  const {progressCsv} = await import('../src/ui/progress-view');
  const m = new Map<string, string>(),
    storage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  const book = new Profiles(storage);
  book.add('민준');
  const rows = book.progress();
  assert.deepEqual(
    rows.map(r => r.name),
    ['첫 항해사', '민준'],
  );
  assert.equal(rows[0].stages.length, 4);
  assert.equal(rows[1].saved, '');
  const csv = progressCsv(rows).split('\r\n');
  assert.match(csv[0], /^﻿이름,출항의 해변 · 완주,출항의 해변 · 별점/);
  assert.match(csv[2], /^민준,X,0,0,/);
});
