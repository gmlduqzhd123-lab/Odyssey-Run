import test from 'node:test';
import assert from 'node:assert/strict';
import {QUIZ, PERSON_MYTHS} from '../src/levels/quiz';
import {PEOPLE} from '../src/assets/catalog';
import {emptySave, validateSave} from '../src/storage/save';

test('myth quiz questions have unique ids, three distinct options and a valid answer', () => {
  assert.ok(QUIZ.length >= 15);
  assert.equal(new Set(QUIZ.map(q => q.id)).size, QUIZ.length);
  for (const q of QUIZ) {
    assert.equal(new Set(q.options).size, 3, q.id);
    assert.ok([0, 1, 2].includes(q.answer), q.id);
    assert.ok(q.explain.length > 10, q.id);
  }
  // Answers are spread across positions so guessing one letter does not win.
  for (const n of [0, 1, 2]) assert.ok(QUIZ.filter(q => q.answer === n).length >= 4);
  for (const id of Object.keys(PERSON_MYTHS))
    assert.ok(
      PEOPLE.some(p => p.id === id),
      id,
    );
});

test('saves keep answered quiz ids, default to none and reject unknown or duplicate ids', () => {
  const s = emptySave();
  assert.deepEqual(s.quiz, []);
  const old: Partial<typeof s> = structuredClone(s);
  delete old.quiz;
  assert.deepEqual(validateSave(old).quiz, []);
  assert.deepEqual(validateSave({...s, quiz: ['home', 'owl']}).quiz, ['home', 'owl']);
  for (const quiz of [['nope'], ['home', 'home'], 'home', [3]]) assert.throws(() => validateSave({...s, quiz}));
});
