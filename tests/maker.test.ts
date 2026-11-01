import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES} from '../src/levels/courses';
import {
  BLOCK_IDS,
  MAKER_SLOTS,
  buildCustom,
  checkCustom,
  isBlocks,
  makerLength,
  randomBlocks,
} from '../src/levels/maker';
import {seeded} from '../src/levels/endless';
import {decodeLink, encodeLink, linkUrl, parseLinkText} from '../src/systems/share';

test('every block, alone and next to any other, can be cleared without losing a heart', () => {
  for (const a of BLOCK_IDS)
    for (const b of BLOCK_IDS) {
      const r = checkCustom(buildCustom('circe', 'ff' + a + b + 'ffffff'));
      assert.ok(r.ok, a + b + ' ' + r.kind);
    }
  for (const stage of STAGES) assert.ok(checkCustom(buildCustom(stage, 'pskhgobwlv')).ok, stage);
});

test('built courses are the right length, keep their pieces apart and never carry maps or spells', () => {
  const c = buildCustom('circe', 'pbwlvskhgo', '지우의 코스');
  assert.equal(c.length, makerLength());
  assert.equal(c.name, '지우의 코스');
  assert.equal(c.spells, undefined);
  assert.ok(!c.items.some(i => i.kind !== 'star'));
  assert.equal(c.gaps.length, 5);
  assert.equal(c.platforms.filter(p => p.crumble).length, 1);
  assert.equal(c.platforms.filter(p => p.seesaw).length, 1);
  assert.equal(c.platforms.filter(p => p.lift).length, 1);
  assert.equal(c.winds.length, 1);
  assert.throws(() => buildCustom('beach', 'xxxxxxxxxx'));
  assert.ok(!isBlocks('fff'));
  // Random courses always pass the check.
  const random = seeded('maker');
  for (let i = 0; i < 5; i++) assert.ok(checkCustom(buildCustom('beach', randomBlocks(random))).ok);
});

test('course links round-trip through the QR code and reject tampering', () => {
  const link = {kind: 'course' as const, stage: 'wind' as const, blocks: 'fpskhgobwl', title: '바람 계곡'};
  assert.equal(link.blocks.length, MAKER_SLOTS);
  assert.deepEqual(decodeLink(encodeLink(link)), link);
  const url = linkUrl(link, 'https://x/Odyssey-Run/');
  assert.match(url, /#m=m1\.wind\.fpskhgobwl\./);
  assert.deepEqual(parseLinkText(url), link);
  const code = encodeLink(link);
  assert.throws(() => decodeLink(code.replace('fpskhgobwl', 'fpskhgobwz')));
  assert.throws(() => decodeLink(code.replace('wind', 'mars')));
});
