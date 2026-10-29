import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCell, parseCsv, toCsv} from '../scripts/translations';

test('the translation review sheet survives a CSV round trip with commas, quotes and line breaks', () => {
  const rows = [
    ['한국어', 'English'],
    ['‘{x}’ 지우기', 'Delete {x}'],
    ['가, 나', 'He said "go",\nthen left'],
  ];
  const csv = toCsv(rows);
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(parseCsv(csv), rows);
});

test('an edited translation must keep its slots in order and leave no Korean', () => {
  assert.equal(checkCell('{n}번 · {x}', 'No. {n} · {x}'), '');
  assert.match(checkCell('{n}번 · {x}', '{x} · No. {n}'), /slots/);
  assert.match(checkCell('점프', '跳{x}'), /slots/);
  assert.equal(checkCell('점프', '점프!'), 'Korean left');
  assert.equal(checkCell('점프', ' '), 'empty');
  assert.equal(checkCell('© 엽쌤', '© 엽쌤'), '');
});
