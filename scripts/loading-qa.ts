import {existsSync} from 'node:fs';
import {chromium, expect} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const result: any = {};
try {
  const c = await b.newContext({viewport: {width: 1280, height: 800}, serviceWorkers: 'block'}),
    p = await c.newPage();
  const errors: string[] = [];
  p.on('pageerror', e => errors.push(e.message));
  const url = 'http://localhost:4176/Odyssey-Run/';
  let broken = true,
    hold = false,
    release: (() => void) | null = null;
  await c.route('**/assets/cave-mid.svg', async r => {
    if (hold)
      await new Promise<void>(resolve => {
        release = resolve;
      });
    if (broken) await r.abort();
    else await r.continue();
  });
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.locator('[data-action="settings"]').click();
  await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');
  await p.locator('[data-action="import-confirm"]').click();
  await p.locator('[data-action="home"]').click();
  await p.locator('[data-action="islands"]').first().click();
  await p.locator('[data-action="stage:cave"]').click();
  await expect(p.locator('[data-action="stage:cave"]')).toContainText('다시 준비');
  result.requiredFileFailureRecoverable = true;
  broken = false;
  await p.locator('[data-action="stage:cave"]').click();
  await expect(p.locator('[data-action="start"]')).toBeVisible();
  await p.locator('[data-action="start"]').click();
  await p.waitForSelector('.play-ui');
  await p.keyboard.press('Escape');
  await expect(p.locator('[data-action="resume"]')).toBeVisible();
  await p.locator('[data-action="islands"]').click();
  // A different island selected while preparation is pending must not reopen stale UI.
  await c.route('**/assets/wind-mid.svg', async r => {
    await new Promise<void>(resolve => {
      release = resolve;
    });
    await r.continue();
  });
  await p.locator('[data-action="stage:wind"]').click();
  await expect(p.locator('#stage-loading')).toBeVisible();
  await expect.poll(() => !!release).toBe(true);
  await p.locator('[data-action="islands"]').click();
  (release as (() => void) | null)?.();
  await p.waitForTimeout(400);
  await expect(p.locator('.islands')).toBeVisible();
  result.cancelledPreparationDoesNotReopen = true;
  await p.locator('[data-action="home"]').click();
  await p.waitForTimeout(150);
  await p.screenshot({path: 'artifacts/roadmap-desktop-home.png'});
  await p.locator('[data-action="settings"]').click();
  const old = JSON.parse(await readFile('artifacts/legacy-v1-save.json', 'utf8'));
  const current = await p.evaluate(() =>
    JSON.parse(
      localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith(':save') && k.startsWith('odyssey-run:'))!)!,
    ),
  );
  // Islands added after the save was written start empty; the original records stay exact.
  expect(current.stages).toEqual({
    ...old.stages,
    sea: {complete: false, bestScore: 0, bestRating: 0, bestStars: 0, maps: []},
  });
  expect(current.settings).toEqual(old.settings);
  result.legacyCorePreserved = true;
  expect(errors).toEqual([]);
  await writeFile(
    'artifacts/roadmap-loading-results.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        browser: await b.version(),
        environment:
          'Linux Chromium 1280x800 desktop; real rendering/network, file failure injected; no service worker',
        result,
        errors,
      },
      null,
      2,
    ),
  );
  await c.close();
} finally {
  await b.close();
}
