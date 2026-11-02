import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPTERS, chapter, chapterOpen} from '../src/levels/chronicle';
import {STAGES} from '../src/levels/courses';
import {REGIONS} from '../src/assets/terrain';
import {emptySave} from '../src/storage/save';

test('the chronicle runs from Troy through every island to Ithaca, three lines a chapter', () => {
  assert.deepEqual(
    CHAPTERS.map(c => c.id),
    ['troy', ...STAGES, 'ithaca'],
  );
  for (const c of CHAPTERS) {
    assert.equal(c.lines.length, 3, c.id);
    assert.ok(REGIONS[c.view], c.id);
  }
  assert.equal(chapter('cave')?.title, '외눈박이 거인의 동굴');
});

test('chapters open with their island and Ithaca with every island', () => {
  const s = emptySave();
  assert.deepEqual(
    CHAPTERS.filter(c => chapterOpen(s, c.id)).map(c => c.id),
    ['troy'],
  );
  s.stages.beach.complete = true;
  assert.ok(chapterOpen(s, 'beach') && !chapterOpen(s, 'ithaca'));
  for (const id of STAGES) s.stages[id].complete = true;
  assert.ok(chapterOpen(s, 'ithaca'));
});
