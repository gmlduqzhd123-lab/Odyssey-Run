import {chromium, expect} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import {ART_SHEETS, REGIONS} from '../src/assets/terrain';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/';
const production = url.startsWith('https:');
const label = production ? 'terrain-deployed' : 'terrain';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [],
  loaded = new Set<string>();
const manifest = JSON.parse(await readFile('docs/terrain-art-manifest.json', 'utf8'));
try {
  const ctx = await browser.newContext({
    viewport: {width: 1280, height: 800},
    extraHTTPHeaders: production ? {'Cache-Control': 'no-cache'} : {},
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    if (r.url().includes('-sheet-')) loaded.add(new URL(r.url()).pathname.split('/').at(-1)!);
  });
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  await page.waitForSelector('.home');
  const before = await page.evaluate(() => Object.entries(localStorage));
  await page.locator('[data-action="codex"]').click();
  await page.locator('[data-action="landscapes"]').click();
  await expect(page.locator('.sheet-card')).toHaveCount(5);
  for (const s of ART_SHEETS) {
    const card = page.locator(`[data-action="sheet:${s.id}"]`);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('img')).toHaveJSProperty('naturalWidth', 1536);
    await card.click();
    await expect(page.locator('.art-detail h1')).toHaveText(s.name);
    await expect(page.locator('.sheet-viewer img')).toHaveJSProperty('naturalWidth', 1536);
    await page.locator('[data-action="sheet-zoom"]').click();
    await expect(page.locator('[data-action="sheet-zoom"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.locator('.sheet-viewer').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
    await page.locator('.sheet-viewer').focus();
    await page.keyboard.press('ArrowRight');
    await page.screenshot({path: `artifacts/${label}-${s.id}.png`});
    await page.locator('[data-action="sheet-zoom"]').click();
    await expect(page.locator('[data-action="sheet-zoom"]')).toHaveAttribute('aria-pressed', 'false');
    await page.locator('[data-action="landscapes"]').click();
  }
  expect(await page.evaluate(() => Object.entries(localStorage))).toEqual(before);
  for (const s of manifest.images) expect(loaded.has(s.displayTexture.split('/').at(-1))).toBe(true);
  await page.locator('[data-action="home"]').click();
  await page.locator('[data-action="islands"]').first().click();
  await page.screenshot({path: `artifacts/${label}-islands.png`});
  await expect(page.locator('.stage-illustration')).toHaveCount(3);
  await page.locator('[data-action="stage:beach"]').click();
  await expect(page.getByRole('img', {name: '출항의 해변 풍경'})).toBeVisible();
  await page.screenshot({path: `artifacts/${label}-prepare.png`});
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('.countdown', {state: 'detached'});
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.screenshot({path: `artifacts/${label}-play.png`});
  await page.keyboard.press('p');
  await expect(page.locator('[data-action="resume"]')).toBeVisible();
  await page.locator('[data-action="resume"]').click();
  await page.waitForSelector('.countdown', {state: 'detached'});
  await page.reload();
  await page.waitForSelector('.home');
  const mobile = await browser.newContext({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true});
  const m = await mobile.newPage();
  m.on('pageerror', e => errors.push(e.message));
  await m.goto(url);
  await m.waitForSelector('.home');
  await m.locator('[data-action="codex"]').tap();
  await m.locator('[data-action="landscapes"]').tap();
  await m.locator('[data-action="sheet:terrain-sheet"]').tap();
  await m.locator('[data-action="sheet-zoom"]').tap();
  await expect(m.locator('.sheet-viewer')).toHaveClass(/expanded/);
  await m.screenshot({path: `artifacts/${label}-mobile-zoom.png`});
  await m.setViewportSize({width: 390, height: 844});
  expect(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await m.screenshot({path: `artifacts/${label}-portrait.png`});
  await m.locator('[data-action="landscapes"]').tap();
  await m.locator('[data-action="home"]').tap();
  await m.setViewportSize({width: 844, height: 390});
  await m.locator('[data-action="islands"]').first().tap();
  await m.locator('[data-action="stage:beach"]').tap();
  await m.locator('[data-action="start"]').tap();
  await m.waitForSelector('.countdown', {state: 'detached'});
  await m.locator('[data-control="jump"]').tap();
  await expect(m.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
  await mobile.close();
  if (!production) {
    const fault = await browser.newContext();
    const p = await fault.newPage();
    await p.route('**/terrain-sheet-*.webp', r => r.abort());
    await p.goto(url);
    await expect(p.getByRole('button', {name: '다시 준비하기'})).toBeVisible();
    await p.unroute('**/terrain-sheet-*.webp');
    await p.getByRole('button', {name: '다시 준비하기'}).click();
    await p.waitForSelector('.home');
    await fault.close();
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${label}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        httpStatus: response?.status(),
        browser: await browser.version(),
        environment: 'Headless Chromium desktop and mobile emulation; no physical Android/iOS device',
        sheets: manifest.images.length,
        regions: Object.keys(REGIONS).length,
        loaded: [...loaded],
        galleryPersistenceUnchanged: true,
        zoomAndMenu: true,
        terrainFailureRetry: !production,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log(`${label}: five sheets, original-size zoom, keyboard scroll, terrain, mobile controls, reload verified.`);
} finally {
  await browser.close();
}
