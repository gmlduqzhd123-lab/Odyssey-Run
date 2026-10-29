import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGS} from '../src/i18n';
import {PAGES, pageFile, render} from '../scripts/school-setup';

test('the school setup guide exists in every game language and matches its source', () => {
  assert.deepEqual(Object.keys(PAGES).sort(), LANGS.map(l => l.id).sort());
  for (const id of Object.keys(PAGES)) {
    const html = readFileSync(`public/${pageFile(id)}`, 'utf8');
    assert.equal(html, render(id), `${pageFile(id)} is stale: run npx tsx scripts/school-setup.ts`);
    if (id !== 'ko') assert.doesNotMatch(html.replace(/<a [^>]*>한국어<\/a>/, ''), /[가-힣]/, id);
    assert.doesNotMatch(html, /<script/);
  }
});
