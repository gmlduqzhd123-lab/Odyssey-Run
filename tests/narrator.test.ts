import test from 'node:test';
import assert from 'node:assert/strict';
import {sentences, canNarrate} from '../src/systems/narrator';

test('stories split into sentences for reading aloud in every language', () => {
  assert.deepEqual(sentences('오디세우스는 이타카로 향했어요. 길고 긴 항해의 시작이에요.'), [
    '오디세우스는 이타카로 향했어요.',
    '길고 긴 항해의 시작이에요.',
  ]);
  assert.deepEqual(sentences('“이것을 지니면 키르케의 잔도 너를 바꾸지 못할 것이다.” 그는 말했어요!'), [
    '“이것을 지니면 키르케의 잔도 너를 바꾸지 못할 것이다.”',
    '그는 말했어요!',
  ]);
  assert.deepEqual(sentences('Hello there. How are you?'), ['Hello there.', 'How are you?']);
  assert.deepEqual(sentences('奥德修斯回家了。很好！'), ['奥德修斯回家了。', '很好！']);
  assert.deepEqual(sentences('  '), []);
  // Node has no speech voices: the button is simply left out there.
  assert.equal(canNarrate(), false);
});
