import test from 'node:test';
import assert from 'node:assert/strict';
import {blanks, blankFrom} from '../src/ui/worksheet-view';
import {MAP_STORIES} from '../src/levels/courses';
import {EN} from '../src/i18n/en';
import VI from '../src/i18n/vi';
import ZH from '../src/i18n/zh';
import RU from '../src/i18n/ru';
import {loadDictionary} from '../src/i18n';

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
test('the worksheet blanks a keyword in at least eight stories in every language', async () => {
  for (const [lang, dict] of [
    ['en', EN],
    ['vi', VI],
    ['zh', ZH],
    ['ru', RU],
  ] as const) {
    const lines = MAP_STORIES.map(([, story]) => blankFrom(dict[story] ?? EN[story], lang)),
      found = lines.filter(b => b !== null);
    assert.ok(found.length >= 8, `${lang}: ${found.length}`);
    // Every island has a line of its own, so a sheet for one island has something from it.
    for (let i = 0; i < MAP_STORIES.length; i += 3)
      assert.ok(
        lines.slice(i, i + 3).some(b => b),
        `${lang}: no blank for island ${i / 3 + 1}`,
      );
    for (const b of found) {
      assert.ok(b.text.includes('(            )'));
      // The blank covers a whole word, not a piece of one (Chinese has no spaces; its keywords are whole words).
      if (lang !== 'zh') assert.doesNotMatch(b.text, /\p{L}\(            \)|\(            \)\p{L}/u, b.text);
    }
  }
  // The live path translates the story first.
  await loadDictionary('en');
  assert.ok(blanks('en').length >= 8);
});
