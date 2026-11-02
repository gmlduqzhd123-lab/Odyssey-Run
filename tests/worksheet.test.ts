import test from 'node:test';
import assert from 'node:assert/strict';
import {blanks} from '../src/ui/worksheet-view';
import {MAP_STORIES} from '../src/levels/courses';

test('worksheet blanks come from the map stories and each hides one word from its sentence', () => {
  const b = blanks();
  assert.ok(b.length >= 8);
  for (const x of b) {
    assert.ok(x.text.includes('(            )'), x.text);
    assert.ok(!x.text.includes(x.answer) || x.answer === '별', x.text);
    assert.ok(
      MAP_STORIES.some(([, story]) => story.startsWith(x.text.replace('(            )', x.answer))),
      x.text,
    );
  }
});
