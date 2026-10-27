import {chromium, expect} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/';
const production = url.startsWith('https:'),
  prefix = production ? 'expansion-deployed' : 'expansion';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [];
try {
  const p = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 2});
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await p.clock.install();
  const response = await p.goto(url);
  await p.waitForSelector('.home');
  const bundle = await p.locator('script[type="module"]').getAttribute('src');
  const expected = (await readFile('dist/index.html', 'utf8')).match(
    /<script(?=[^>]*type="module")[^>]*src="([^"]+)"/,
  )![1];
  expect(bundle).toBe(expected);
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
  await p.locator('[data-action="islands"]').first().click();
  await p.locator('[data-action="stage:beach"]').click();
  await p.locator('[data-action="start"]').click();
  while (await p.locator('.countdown').count()) await p.clock.runFor(17);
  const x = async () => Number(await p.locator('#progress').getAttribute('data-distance'));
  const advance = async (target: number) => {
    while ((await x()) < target)
      await p.clock.runFor(Math.max(17, Math.min(200, Math.ceil(((target - (await x())) / 320) * 1000))));
  };
  const plan = routeInputs('beach'),
    inputs = [
      ...plan.jumps.filter(x => x < 7800).map(x => ({x, type: 'jump'})),
      ...plan.slides
        .filter(s => s.start < 7800)
        .flatMap(s => [
          {x: s.start, type: 'down'},
          {x: s.end, type: 'up'},
        ]),
    ].sort((a, b) => a.x - b.x);
  for (const event of inputs) {
    await advance(event.x);
    if (event.type === 'jump') await p.keyboard.press('Space');
    else if (event.type === 'down') await p.keyboard.down('ArrowDown');
    else await p.keyboard.up('ArrowDown');
  }
  await advance(8400);
  const stars = await p.locator('#stars').innerText();
  let beforeScore = '',
    guard = 0;
  while ((await x()) > 8000 && guard++ < 200) {
    beforeScore = (await p.locator('#score').innerText()).replaceAll(',', '');
    await p.clock.runFor(17);
  }
  expect(guard).toBeLessThan(200);
  const recoveryX = await x();
  expect(recoveryX).toBeGreaterThanOrEqual(7720);
  expect(recoveryX - 7720).toBeLessThanOrEqual((320 / 60) * 2 + 1e-6);
  await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 2');
  expect(await p.locator('#stars').innerText()).toBe(stars);
  expect(Number((await p.locator('#score').innerText()).replaceAll(',', ''))).toBeGreaterThanOrEqual(
    Number(beforeScore),
  );
  const recoveredScore = await p.locator('#score').innerText();
  await p.screenshot({path: `artifacts/${prefix}-compass-recovery.png`});
  await advance(8400);
  expect(await p.locator('#score').innerText()).toBe(recoveredScore);
  expect(await p.locator('#stars').innerText()).toBe(stars);
  await p.keyboard.press('p');
  await p.locator('[data-action="restart"]').click();
  await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
  await expect(p.locator('#effects')).toHaveText('');
  await expect(p.locator('#score')).toHaveText('0');
  await p.locator('.countdown [data-action="pause"]').click();
  await p.locator('[data-action="islands"]').click();
  await p.locator('[data-action="home"]').click();
  await p.locator('[data-action="settings"]').click();
  const legacy = JSON.parse(await readFile('artifacts/legacy-v1-save.json', 'utf8'));
  await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');
  await p.locator('[data-action="import-confirm"]').click();
  await p.reload();
  await p.waitForSelector('.home');
  const actual = await p.evaluate(() => {
    const k = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
    return JSON.parse(localStorage.getItem(k)!);
  });
  expect(actual.stages).toEqual(legacy.stages);
  expect(actual.settings).toEqual(legacy.settings);
  await p.locator('[data-action="codex"]').click();
  await expect(p.locator('.fragment.found')).toHaveCount(9);
  await p.locator('[data-action="bestiary"]').click();
  await expect(p.locator('.monster-card')).toHaveCount(6);
  await p.screenshot({path: `artifacts/${prefix}-bestiary.png`});
  await p.locator('[data-action="relics"]').click();
  await expect(p.locator('.relic-kind').filter({hasText: '달리기 아이템'})).toHaveCount(8);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        status: response?.status(),
        bundle,
        browser: await browser.version(),
        checkedAt: new Date().toISOString(),
        environment: 'Linux Chromium desktop DPR2, actual keyboard inputs, virtual clock; independent browser storage',
        compassCheckpoint: 7720,
        observedRecoveryX: recoveryX,
        fallHp: 2,
        duplicateScoreAndStarsPrevented: true,
        restartClearsEffects: true,
        legacyV1ExactRecordsPreserved: true,
        bestiaryKinds: 6,
        realItemKinds: 8,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log(prefix, 'compass fall/return/no duplicate, restart, prior v1 file and codex passed');
} finally {
  await browser.close();
}
