import {chromium, expect, type Page} from '@playwright/test';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
// Visits every screen in English and fails if visible Korean text or labels remain.
// Sailor names and the author's name may stay in Hangul.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  allowed = [/^엽쌤/, /엽쌤/, /^첫 항해사$/, /^한국어$/, /^지우$/];
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
// Plain source: tsx would wrap named functions with a helper the page does not have.
const SCAN = `(() => {
  const out = [], H = /[가-힣]/;
  const visible = el => (el.checkVisibility ? el.checkVisibility() : true);
  const walk = n => {
    if (n.nodeType === 3) {
      const t = (n.nodeValue || '').trim();
      if (t && H.test(t) && n.parentElement && visible(n.parentElement)) out.push(t);
      return;
    }
    if (n.nodeType !== 1) return;
    if (n.getAttribute('translate') === 'no' || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
    for (const a of ['aria-label', 'placeholder', 'alt', 'title']) {
      const v = n.getAttribute(a);
      if (v && H.test(v)) out.push('@' + a + ': ' + v);
    }
    n.childNodes.forEach(walk);
  };
  walk(document.body);
  if (H.test(document.title)) out.push('@title: ' + document.title);
  return out;
})()`;
const found = new Map<string, Set<string>>(),
  errors: string[] = [];
async function scan(p: Page, screen: string) {
  await p.waitForTimeout(80);
  const left: string[] = await p.evaluate(SCAN);
  for (const t of left.filter(t => !allowed.some(a => a.test(t.replace(/^@[a-z-]+: /, ''))))) {
    if (!found.has(t)) found.set(t, new Set());
    found.get(t)!.add(screen);
  }
}
try {
  const c = await b.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'});
  await c.addInitScript(() => localStorage.setItem('odyssey-run:lang', 'en'));
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  const toHome = async () => {
    await p.goto(url);
    await p.waitForSelector('.home');
  };
  const go = async (action: string, screen = action) => {
    await p.locator(`[data-action="${action}"]:visible`).first().click();
    await scan(p, screen);
  };
  await p.goto(url);
  await p.waitForSelector('.home');
  await expect(p.locator('h1')).toContainText('Odyssey Run');
  await scan(p, 'home');
  await go('settings');
  await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');
  await p.waitForSelector('[data-action="import-confirm"]');
  await scan(p, 'import');
  await p.locator('[data-action="import-confirm"]').click();
  await p
    .locator('#import-file')
    .setInputFiles({name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}')});
  await expect(p.locator('#import-error')).not.toBeEmpty();
  await scan(p, 'import-error');
  await scan(p, 'settings');
  await go('touch-layout');
  await go('layout-save', 'settings');
  await go('offline');
  await go('settings');
  await go('reset-confirm');
  await go('settings');
  await toHome();
  for (const screen of ['islands', 'codex', 'journal', 'harbor', 'wardrobe', 'challenges', 'profiles']) {
    await toHome();
    await go(screen);
  }
  await toHome();
  await go('codex');
  await go('story:0', 'story');
  await go('codex');
  for (const screen of ['people', 'relics', 'bestiary', 'landscapes']) await go(screen);
  await p.locator('[data-action^="sheet:"]').first().click();
  await scan(p, 'sheet');
  await go('landscapes');
  await go('people');
  await p.locator('[data-action^="person:"]').first().click();
  await scan(p, 'person');
  await go('people');
  await go('quiz');
  await p.locator('[data-action^="quiz-answer:"]').first().click();
  await scan(p, 'quiz-answer');
  await toHome();
  await go('challenges');
  await go('contests');
  await p.fill('#contest-title', 'Class 3');
  await go('contest-create', 'contest-board');
  const join = await p.locator('#share-url').inputValue();
  await toHome();
  await go('challenges');
  await go('daily', 'daily-prepare');
  await p.waitForSelector('[data-action="start"]');
  await scan(p, 'daily-prepare');
  await go('challenges');
  await go('boss:beach', 'boss-prepare');
  await p.waitForSelector('[data-action="start"]');
  await scan(p, 'boss-prepare');
  await go('challenges');
  await go('endless:wind', 'endless-prepare');
  await p.waitForSelector('[data-action="start"]');
  await scan(p, 'endless-prepare');
  await toHome();
  for (const stage of ['beach', 'cave', 'wind', 'sea']) {
    await go('islands');
    await p.locator(`[data-action="stage:${stage}"]`).click();
    await p.waitForSelector('[data-action="start"]');
    await scan(p, 'prepare-' + stage);
  }
  await p.locator('[data-action="start"]').click();
  await scan(p, 'countdown');
  await p.waitForSelector('.countdown', {state: 'detached'});
  await p.waitForTimeout(1500);
  await scan(p, 'play');
  await p.keyboard.press('Escape');
  await scan(p, 'pause');
  // Run until the voyage ends to reach the result screen.
  await p.locator('[data-action="resume"]').click();
  await p.waitForSelector('.countdown', {state: 'detached'});
  await p.waitForSelector('.result', {timeout: 120000});
  await scan(p, 'result');
  await go('share');
  const rival = await p.locator('#share-url').inputValue();
  await p.goto(rival);
  await p.waitForSelector('.rival-panel');
  await scan(p, 'rival');
  await go('rival-start', 'rival-prepare');
  await p.waitForSelector('[data-action="start"]');
  await scan(p, 'rival-prepare');
  await p.goto(join);
  await p.waitForSelector('.contest-panel');
  await scan(p, 'contest-join');
  await go('contest-run', 'contest-prepare');
  await p.waitForSelector('[data-action="start"]');
  await scan(p, 'contest-prepare');
  await toHome();
  await go('profiles');
  await p.fill('#profile-name', 'Kim');
  await go('profile-add', 'profile-added');
  await go('profile-use:main', 'profile-used');
  await p.locator('[data-action^="profile-delete:"]').first().click();
  await scan(p, 'profile-delete');
  await go('profiles');
  await toHome();
  await go('quit');
  // Canvas captions never reach the DOM; the translator records what it could not translate.
  const missed: string[] = await p.evaluate('[...(window.__i18nMissing || [])]');
  for (const t of missed.filter(t => !allowed.some(a => a.test(t)))) {
    if (!found.has(t)) found.set(t, new Set());
    found.get(t)!.add('translate()');
  }
  const report = [...found].map(([text, screens]) => ({text, screens: [...screens]}));
  await writeFile(
    'artifacts/i18n-results.json',
    JSON.stringify({checkedAt: new Date().toISOString(), report, errors}, null, 2),
  );
  for (const r of report) console.log(`${r.screens.join(',')}\t${r.text}`);
  console.log(`i18n: ${report.length} untranslated, ${errors.length} page errors`);
  if (report.length || errors.length) process.exitCode = 1;
} finally {
  await b.close();
}
