import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';

// The bundled UI font holds only the characters the game's own text uses. New on-screen text
// with a character outside it would silently fall back to the device font, so it fails here
// until scripts/subset-font.py is run again.
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));

test('the bundled font covers every character of the game text', () => {
  const covered = new Set(readFileSync('public/fonts/odyssey-ui.chars.txt', 'utf8'));
  const missing = new Set<string>();
  // Vietnamese and Russian letters come from the second file; Chinese from the device font, as
  // does 中文 in the language list.
  const extra = (ch: string) =>
      [
        [0xc0, 0x24f],
        [0x300, 0x36f],
        [0x400, 0x4ff],
        [0x1e00, 0x1eff],
      ].some(([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b) && !'×÷'.includes(ch),
    native = new Set('中文');
  const other = (f: string) => /i18n[\\/](vi|zh|ru)(-\d)?\.ts$/.test(f);
  for (const f of [...files('src').filter(f => f.endsWith('.ts') && !other(f)), 'index.html'])
    for (const ch of readFileSync(f, 'utf8'))
      if (ch.codePointAt(0)! > 0x7e && !/\s/.test(ch) && !covered.has(ch) && !extra(ch) && !native.has(ch))
        missing.add(`${ch} (${f})`);
  assert.deepEqual([...missing], []);
  assert.ok(statSync('public/fonts/odyssey-ui.woff2').size < 200 * 1024, 'font stays small');
});
test('Vietnamese and Russian letters have their own small font file', () => {
  const css = readFileSync('src/style.css', 'utf8');
  assert.match(css, /odyssey-ui-extra\.woff2[^}]+unicode-range: U\+C0-D6, U\+D8-F6/);
  assert.ok(statSync('public/fonts/odyssey-ui-extra.woff2').size < 40 * 1024);
});
