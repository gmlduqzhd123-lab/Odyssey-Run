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
test('the worksheet asks the class notebook questions first and adds the island reading with its key', async () => {
  const {worksheetMarkup, notebookCounts} = await import('../src/ui/worksheet-view');
  const {QUIZ} = await import('../src/levels/quiz-text');
  const {readingFor} = await import('../src/levels/readings');
  const report = QUIZ.map(q => ({id: q.id, question: q.question, answered: 0, right: 0, wrong: null, read: ''}));
  const notebook = notebookCounts([{missedIds: ['bow', 'argos']}, {missedIds: ['bow']}]);
  assert.deepEqual(notebook, {bow: 2, argos: 1});
  const html = worksheetMarkup('', report, '2026-11-25', {level: 'mid', stage: 'palace', reading: true}, notebook);
  const quiz = html.slice(html.indexOf('우리 반이 많이 틀린 신화 퀴즈'));
  const bow = QUIZ.find(q => q.id === 'bow')!.question,
    argos = QUIZ.find(q => q.id === 'argos')!.question;
  assert.ok(quiz.indexOf(bow) < quiz.indexOf(argos), 'most notebooks first');
  assert.ok(html.includes('오답 노트 2명'));
  const r = readingFor('palace')!;
  assert.ok(html.includes(r.title) && html.includes(r.questions[0].question));
  const off = worksheetMarkup('', report, '2026-11-25', {level: 'mid', stage: 'palace', reading: false});
  assert.ok(!off.includes(r.questions[0].question));
  assert.ok(off.includes('다시 풀어 보는 신화 퀴즈'), 'no class data: the plain title');
});
