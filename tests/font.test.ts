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
  for (const f of [...files('src').filter(f => f.endsWith('.ts')), 'index.html'])
    for (const ch of readFileSync(f, 'utf8'))
      if (ch.codePointAt(0)! > 0x7e && !/\s/.test(ch) && !covered.has(ch)) missing.add(`${ch} (${f})`);
  assert.deepEqual([...missing], []);
  assert.ok(statSync('public/fonts/odyssey-ui.woff2').size < 200 * 1024, 'font stays small');
});
