import {chromium, expect, type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {emptySave} from '../src/storage/save';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  phase = process.env.QA_PHASE || 'after';
const production = url.startsWith('https:');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const results: Record<string, boolean> = {},
  errors: string[] = [],
  failures: string[] = [];
try {
  const c = await browser.newContext({viewport: {width: 960, height: 620}});
  await c.addInitScript(() => {
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    (window as any).__auditActor = 0;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...a: any[]) {
      const s = a[0];
      if (
        this.canvas.parentElement?.id === 'game' &&
        s instanceof HTMLImageElement &&
        s.naturalWidth === 768 &&
        s.naturalHeight === 512
      ) {
        const m = this.getTransform();
        (window as any).__auditActor = Math.abs(Math.atan2(m.b, m.a)) < 0.01 ? 1 : 0;
      } else if (
        this.canvas.parentElement?.id === 'game' &&
        s instanceof HTMLImageElement &&
        s.naturalWidth === 1536 &&
        s.naturalHeight === 1024 &&
        a[4] > 100
      )
        (window as any).__auditActor = 0;
      return (draw as Function).apply(this, a);
    } as typeof draw;
  });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  const home = async () => {
    await p.goto(url);
    await p.waitForSelector('.home');
  };
  const countdown = async () => {
    await home();
    await p.locator('[data-action="islands"]').first().click();
    await p.locator('[data-action="stage:beach"]').click();
    await p.locator('[data-action="start"]').click();
  };
  const slide = async () => (await p.evaluate(() => (window as any).__auditActor as number)) === 1;
  await countdown();
  await p.keyboard.press('Escape');
  await p.waitForTimeout(100);
  results.escapePausesCountdown = await p.locator('[data-action="resume"]').isVisible();
  await countdown();
  await p.waitForSelector('.countdown', {state: 'detached'});
  await p.locator('[data-control="slide"]').focus();
  await p.keyboard.down('Space');
  await p.waitForTimeout(120);
  results.spaceOnSlideOnlySlides = await slide();
  await p.keyboard.up('Space');
  await p.waitForTimeout(1000);
  await p.locator('[data-control="slide"]').focus();
  await p.keyboard.down('Enter');
  await p.keyboard.down('ArrowDown');
  await p.keyboard.up('ArrowDown');
  await p.waitForTimeout(120);
  results.keyboardSlideSurvivesOtherKeyRelease = await slide();
  await p.keyboard.up('Enter');
  await p.locator('[data-action="pause"]').focus();
  await p.keyboard.press('Space');
  await p.waitForTimeout(100);
  results.spaceActivatesPauseButton = await p.locator('[data-action="resume"]').isVisible();
  if (!results.spaceActivatesPauseButton) await p.keyboard.press('p');
  let behind = false;
  for (let i = 0; i < 14; i++) {
    await p.keyboard.press('Tab');
    behind ||= await p.evaluate(() => !!document.activeElement?.closest('.play-ui'));
  }
  results.pauseExcludesCoveredControls = !behind;
  await p.screenshot({path: `artifacts/audit-${phase}-pause.png`});
  await home();
  await p.evaluate(() => localStorage.setItem('odyssey-run:' + new URL('.', location.href).pathname + ':save', ''));
  await p.reload();
  await p.waitForSelector('.home');
  const warning = await p.locator('#notice').textContent();
  await p.locator('[data-action="islands"]').first().click();
  await p.locator('[data-action="stage:beach"]').click();
  results.emptyCorruptSavePreserved =
    (await p.evaluate(
      () => localStorage.getItem('odyssey-run:' + new URL('.', location.href).pathname + ':save') === '',
    )) && !!warning?.includes('원본');
  // Delay File.text deliberately to reproduce navigation and concurrent-read races.
  const files = async () => {
    await home();
    await p.locator('[data-action="settings"]').click();
    await p.evaluate(() => {
      (window as any).__fileReads = [];
      File.prototype.text = function () {
        return new Promise(resolve => (window as any).__fileReads.push(resolve));
      };
    });
  };
  const resolve = async (index: number, text: string) => {
    await p.evaluate(({index, text}) => (window as any).__fileReads[index](text), {index, text});
    await p.waitForTimeout(100);
  };
  await files();
  const count = errors.length;
  await p
    .locator('#import-file')
    .setInputFiles({name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken')});
  await p.locator('[data-action="home"]').click();
  await resolve(0, '{broken');
  results.lateInvalidImportDoesNotCrash = errors.length === count && (await p.locator('.home').isVisible());
  const valid = emptySave();
  await files();
  await p
    .locator('#import-file')
    .setInputFiles({name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(valid))});
  await p.locator('[data-action="home"]').click();
  await resolve(0, JSON.stringify(valid));
  results.lateValidImportDoesNotHijackScreen = await p.locator('.home').isVisible();
  await files();
  const a = emptySave(),
    b = emptySave();
  a.stages.beach.bestScore = 300;
  b.stages.beach.bestScore = 700;
  await p
    .locator('#import-file')
    .setInputFiles({name: 'first.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(a))});
  await p
    .locator('#import-file')
    .setInputFiles({name: 'second.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(b))});
  await resolve(1, JSON.stringify(b));
  await resolve(0, JSON.stringify(a));
  results.latestImportWins = (await p.locator('.import-list').innerText()).includes('700');
  await p.locator('[data-action="import-confirm"]').click();
  results.latestImportIsConfirmed = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem('odyssey-run:' + new URL('.', location.href).pathname + ':save')!).stages.beach
        .bestScore === 700,
  );
  await writeFile(
    `artifacts/audit-${phase}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment: 'Linux Chromium desktop, real keyboard events; File.text delay injection for race reproduction',
        results,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({phase, results, errors, failures}, null, 2));
  if (phase !== 'before') {
    expect(Object.values(results).every(Boolean)).toBe(true);
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
  }
} finally {
  await browser.close();
}
