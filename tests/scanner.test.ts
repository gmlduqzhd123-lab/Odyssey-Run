import test from 'node:test';
import assert from 'node:assert/strict';
import {toCsv} from '../src/systems/scanner';

test('CSV export opens in spreadsheets and neutralizes formulas', () => {
  const csv = toCsv([
    ['이름', '점수'],
    ['=SUM(A1)', 10],
    ['a,"b"', -3],
  ]);
  assert.ok(csv.startsWith('﻿'));
  assert.equal(csv.slice(1), '이름,점수\r\n\'=SUM(A1),10\r\n"a,""b""",\'-3\r\n');
});
