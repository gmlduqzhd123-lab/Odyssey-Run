import test from 'node:test';
import assert from 'node:assert/strict';
import {EN} from '../src/i18n/en';
import {translateTo} from '../src/i18n';
import {QUIZ} from '../src/levels/quiz';
import {COURSES, STAGES, MAP_STORIES} from '../src/levels/courses';
import {ADVENTURE_PLANS} from '../src/levels/adventure';
import {PEOPLE, RELICS} from '../src/assets/catalog';
import {VARIANT_LABELS} from '../src/levels/variants';
import {BOSSES} from '../src/levels/bosses';

const en = (s: string) => translateTo('en', s);
const H = /[가-힣]/;

test('English entries contain no Korean except the author name, and keep their placeholders', () => {
  for (const [ko, text] of Object.entries(EN)) {
    assert.ok(!H.test(text.replaceAll('엽쌤', '')), `${ko} → ${text}`);
    const slots = (s: string) => (s.match(/\{[xn]\}/g) ?? []).length;
    assert.equal(slots(text), slots(ko), ko);
  }
});

test('every story, quiz, course, person and item text has an English version', () => {
  const texts = [
    ...QUIZ.flatMap(q => [q.question, q.explain, ...q.options]),
    ...STAGES.flatMap(id => [
      COURSES[id].name,
      COURSES[id].description,
      BOSSES[id].name,
      BOSSES[id].description,
      ...BOSSES[id].phases,
    ]),
    ...STAGES.flatMap(id => Object.values(VARIANT_LABELS[id]).flatMap(v => [v.name, v.description])),
    ...Object.values(ADVENTURE_PLANS).flatMap(p => [
      p.highlight.name,
      p.highlight.hint,
      ...p.stories.flatMap(s => [s.title, s.story, s.quote]),
      ...p.constellations.map(c => c.name),
    ]),
    ...MAP_STORIES.flat(),
    ...PEOPLE.flatMap(p => [p.name, p.role, p.story]),
    ...RELICS.flatMap(r => [r.name, r.kind, r.description]),
  ];
  const left = texts.filter(t => H.test(en(t)));
  assert.deepEqual(left, []);
});

test('patterns translate interpolated text, numbers and names, and Korean mode is untouched', () => {
  assert.equal(en('최고 4,130'), 'Best 4,130');
  assert.equal(en('출항의 해변 2마리'), 'Beach of Departure ×2');
  assert.equal(en('출항의 해변 · 기본 항로'), 'Beach of Departure · Classic route');
  assert.equal(en('○ 지도 탐험가'), '○ Map explorer');
  assert.equal(en('‘민준’의 기록이 도착했어요'), '‘민준’’s record has arrived');
  assert.equal(en('  체력 3  '), '  3 HP  ');
  assert.equal(translateTo('ko', '최고 4,130'), '최고 4,130');
  assert.equal(en('Plain English'), 'Plain English');
});
