import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySave} from '../src/storage/save';
import {progress} from '../src/storage/profiles';
import {recordQuiz} from '../src/storage/feats';
import {QUIZ, QUIZ_READ, quizIds} from '../src/levels/quiz';
import {MAP_STORIES} from '../src/levels/courses';
import {FLEET_STEPS, defaultFleetGoal, fleetMarkup, quizReport, quizReportCsv} from '../src/ui/class-view';

const sailor = (name: string, answers: [string, number][]) => {
  let s = emptySave();
  for (const [id, choice] of answers) s = recordQuiz(s, id, choice, '2026-11-02');
  return {id: name, name, ...progress(s)};
};

test('every quiz question points to something to read again', () => {
  for (const id of quizIds) {
    const read = QUIZ_READ[id];
    assert.ok(read, id);
    if ('story' in read) assert.ok(MAP_STORIES[read.story], id);
  }
});

test('the quiz report adds up every sailor, finds the favourite wrong answer and suggests a story', () => {
  const rows = [
    sailor('가', [
      ['opened', 0],
      ['opened', 2],
      ['home', 0],
    ]),
    sailor('나', [
      ['opened', 0],
      ['home', 1],
    ]),
  ];
  const report = quizReport(rows),
    opened = report.find(r => r.id === 'opened')!,
    q = QUIZ.find(q => q.id === 'opened')!;
  assert.equal(opened.answered, 3);
  assert.equal(opened.right, q.answer === 0 ? 2 : q.answer === 2 ? 1 : 0);
  assert.ok(opened.read.includes('열린 바람 자루'));
  assert.equal(report.find(r => r.id === 'home')!.answered, 2);
  assert.equal(report.find(r => r.id === 'home')!.wrong, '크레타');
  assert.equal(report.find(r => r.id === 'pigs')!.answered, 0);
  const csv = quizReportCsv(rows).split('\r\n').filter(Boolean);
  assert.equal(csv.length, QUIZ.length + 1);
});

test('the class fleet moves with everyone’s starlight toward Ithaca', () => {
  assert.equal(FLEET_STEPS.at(-1), '이타카');
  assert.equal(FLEET_STEPS.length, 6);
  assert.equal(defaultFleetGoal(20), 3000);
  assert.match(fleetMarkup(0, 3000, 20), /이타카까지 100%/);
  assert.match(fleetMarkup(1500, 3000, 20), /이타카까지 50%/);
  assert.match(fleetMarkup(4000, 3000, 20), /이타카에 도착/);
});
