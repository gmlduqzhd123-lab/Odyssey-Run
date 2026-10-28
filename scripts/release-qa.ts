import {existsSync} from 'node:fs';
import {chromium, webkit, expect, type Page} from '@playwright/test';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {routeInputs} from './check-routes';
import {bossInputs} from '../src/levels/bosses';
import {STAGES} from '../src/levels/courses';
import {dailySpec, koreanDay} from '../src/levels/daily';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  engine = process.env.QA_ENGINE || 'chromium',
  prefix = process.env.QA_PREFIX || `roadmap-${engine}`,
  production = url.startsWith('https:');
const b = await (engine === 'webkit' ? webkit : chromium).launch({
  ...(engine === 'chromium'
    ? {
        executablePath:
          process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
        args: ['--no-sandbox'],
      }
    : {}),
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [],
  results: any[] = [];
await mkdir('artifacts', {recursive: true});
try {
  const c = await b.newContext({
    viewport: {width: 844, height: 390},
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  const requests: string[] = [];
  p.on('request', r => requests.push(r.url()));
  await p.clock.install();
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
  expect(requests.some(u => u.includes('odysseus-run-native'))).toBe(false);
  expect(requests.some(u => u.includes('monsters-'))).toBe(false);
  results.push({homeDeferredGameplay: true});
  const tap = async (s: string) => p.locator(s).first().tap(),
    finishCount = async () => {
      let i = 0;
      while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
      await expect(p.locator('.countdown')).toHaveCount(0);
    };
  const save = () =>
    p.evaluate(() => {
      const k = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
      return JSON.parse(localStorage.getItem(k)!);
    });
  const x = async () => Number(await p.locator('#progress').getAttribute('data-distance'));
  const advance = async (target: number) => {
    let n = 0;
    while ((await x()) < target && n++ < 20) {
      await expect(p.locator('.result')).toHaveCount(0);
      await p.clock.runFor(Math.max(17, Math.ceil(((target - (await x())) / 320) * 1000)));
    }
    expect(await x()).toBeGreaterThanOrEqual(target);
  };
  const session = engine === 'chromium' ? await c.newCDPSession(p) : null;
  let held: any = null;
  const point = async (type: string, id: number) => {
    const box = (await p.locator(`[data-control="${type}"]`).boundingBox())!;
    return {id, x: box.x + box.width / 2, y: box.y + box.height / 2};
  };
  const input = async (type: string) => {
    if (!session) {
      if (type === 'jump') await tap('[data-control="jump"]');
      else if (type === 'down')
        await p.locator('[data-control="slide"]').dispatchEvent('pointerdown', {pointerId: 11, pointerType: 'touch'});
      else
        await p.evaluate(() =>
          window.dispatchEvent(new PointerEvent('pointerup', {pointerId: 11, pointerType: 'touch'})),
        );
      return;
    }
    if (type === 'jump') {
      const jump = await point('jump', 22);
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: held ? [held, jump] : [jump]});
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held ? [held] : []});
    } else if (type === 'down') {
      held = await point('slide', 11);
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [held]});
    } else {
      held = null;
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    }
  };
  const drive = async (plan: {jumps: number[]; slides: {start: number; end: number}[]}, length = 24000) => {
    const events = [
      ...plan.jumps.map(x => ({x, type: 'jump'})),
      ...plan.slides.flatMap(s => [
        {x: s.start, type: 'down'},
        {x: s.end, type: 'up'},
      ]),
    ].sort((a, b) => a.x - b.x);
    for (const e of events) {
      await advance(e.x);
      await input(e.type);
    }
    await advance(length - 300);
    await p.clock.runFor(1800);
    await expect(p.locator('.result')).toBeVisible();
  };
  await tap('[data-action="settings"]');
  await p.locator('[data-setting="music"]').uncheck();
  await p.locator('[data-setting="sfx"]').uncheck();
  await p.locator('#quality').selectOption('low');
  const lowPixels = await p.locator('#game canvas').evaluate((el: any) => el.width * el.height);
  await p.locator('#quality').selectOption('high');
  expect(await p.locator('#game canvas').evaluate((el: any) => el.width * el.height)).toBeGreaterThan(lowPixels);
  await tap('[data-action="touch-layout"]');
  for (const [key, v] of [
    ['size', '96'],
    ['bottom', '18'],
    ['inset', '5'],
    ['opacity', '0.65'],
  ]) {
    await p.locator(`[data-layout="${key}"]`).fill(v);
    await p.locator(`[data-layout="${key}"]`).dispatchEvent('input');
  }
  await p.locator('[data-layout="swapped"]').check();
  await tap('[data-action="layout-save"]');
  await p.reload();
  await p.waitForSelector('.home');
  expect((await save()).preferences.touch).toEqual({size: 96, bottom: 18, inset: 5, opacity: 0.65, swapped: true});
  await tap('[data-action="islands"]');
  await tap('[data-action="stage:beach"]');
  await tap('[data-action="start"]');
  await finishCount();
  const jb = (await p.locator('[data-control="jump"]').boundingBox())!,
    sb = (await p.locator('[data-control="slide"]').boundingBox())!;
  expect(jb.width).toBe(96);
  expect(jb.x).toBeLessThan(sb.x);
  await input('jump');
  await p.clock.runFor(1100);
  await tap('[data-action="pause"]');
  await tap('[data-action="touch-layout"]');
  await p.clock.runFor(10000);
  await tap('[data-action="layout-save"]');
  await expect(p.locator('[data-action="resume"]')).toBeVisible();
  await tap('[data-action="resume"]');
  await finishCount();
  // Turning the phone upright pauses; the run then continues in portrait with the game strip
  // above the buttons, and turning back pauses again.
  await p.setViewportSize({width: 390, height: 844});
  await expect(p.locator('[data-action="resume"]')).toBeVisible();
  const paused = await x();
  await p.clock.runFor(11000);
  expect(await x()).toBe(paused);
  await tap('[data-action="resume"]');
  await finishCount();
  await p.clock.runFor(500);
  expect(await x()).toBeGreaterThan(paused);
  const strip = (await p.locator('#game').boundingBox())!,
    jumpUpright = (await p.locator('[data-control="jump"]').boundingBox())!;
  expect(Math.abs(strip.height - (strip.width * 3) / 4)).toBeLessThan(2);
  expect(jumpUpright.y).toBeGreaterThanOrEqual(strip.y + strip.height - 1);
  await p.setViewportSize({width: 844, height: 390});
  await expect(p.locator('[data-action="resume"]')).toBeVisible();
  await tap('[data-action="resume"]');
  await finishCount();
  await tap('[data-action="pause"]');
  await tap('[data-action="restart"]');
  await finishCount();
  await p.clock.runFor(1000);
  await tap('[data-action="pause"]');
  await tap('[data-action="islands"]');
  await tap('[data-action="stage:beach"]');
  await tap('[data-action="start"]');
  await finishCount();
  for (const id of STAGES) {
    if (id !== 'beach') {
      await tap(`[data-action="stage:${id}"]`);
      await tap('[data-action="start"]');
      await finishCount();
    }
    await drive(routeInputs(id, 'upper', true));
    await expect(p.locator('.result')).toContainText('HP 손실 0회');
    expect((await save()).stages[id].complete).toBe(true);
    await p.screenshot({path: `artifacts/${prefix}-normal-${id}.png`});
    results.push({normal: id, record: (await save()).stages[id]});
    await tap('[data-action="islands"]');
    console.log(prefix, 'normal', id, 'passed');
  }
  const normal = JSON.stringify({
    stages: (await save()).stages,
    courses: (await save()).courses,
    journal: (await save()).journal,
  });
  await tap('[data-action="home"]');
  await tap('[data-action="wardrobe"]');
  await tap('[data-action="equip:cape:sea"]');
  await tap('[data-action="equip:emblem:owl"]');
  await tap('[data-action="equip:sail:sun"]');
  await expect(p.locator('[data-action="equip:cape:sea"]')).toHaveAttribute('aria-pressed', 'true');
  await p.screenshot({path: `artifacts/${prefix}-wardrobe.png`});
  await tap('[data-action="home"]');
  for (const id of STAGES) {
    await tap('[data-action="challenges"]');
    await tap(`[data-action="boss:${id}"]`);
    await tap('[data-action="start"]');
    await finishCount();
    await drive(bossInputs(id), 9600);
    await expect(p.locator('.result')).toContainText('HP 손실 0회');
    expect((await save()).expeditions.bosses[id].complete).toBe(true);
    await p.screenshot({path: `artifacts/${prefix}-boss-${id}.png`});
    results.push({boss: id, record: (await save()).expeditions.bosses[id]});
    await tap('[data-action="home"]');
    console.log(prefix, 'boss', id, 'passed');
  }
  await tap('[data-action="challenges"]');
  await tap('[data-action="daily"]');
  const d = dailySpec(koreanDay(new Date(await p.evaluate(() => Date.now()))));
  await tap('[data-action="start"]');
  await finishCount();
  await drive(routeInputs('beach', 'upper', true, d.variant));
  expect((await save()).expeditions.daily.find((r: any) => r.date === d.date).complete).toBe(true);
  results.push({daily: d, record: (await save()).expeditions.daily});
  await p.screenshot({path: `artifacts/${prefix}-daily.png`});
  expect(
    JSON.stringify({stages: (await save()).stages, courses: (await save()).courses, journal: (await save()).journal}),
  ).toBe(normal);
  // Retry clears temporary state and damage hints explain actual contact.
  await tap('[data-action="restart"]');
  await finishCount();
  await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
  await tap('[data-action="pause"]');
  await tap('[data-action="islands"]');
  await tap('[data-action="stage:beach"]');
  await tap('[data-action="start"]');
  await finishCount();
  await p.clock.runFor(45000);
  await expect(p.locator('.result')).toBeVisible();
  await expect(p.locator('.damage-summary')).toContainText('마지막 HP 손실');
  await p.screenshot({path: `artifacts/${prefix}-damage.png`});
  await tap('[data-action="islands"]');
  await tap('[data-action="home"]');
  await tap('[data-action="settings"]');
  const download = p.waitForEvent('download');
  await tap('[data-action="export"]');
  const file = `artifacts/${prefix}-save.json`;
  await (await download).saveAs(file);
  const exported = JSON.parse(await readFile(file, 'utf8'));
  expect(Buffer.byteLength(JSON.stringify(exported))).toBeLessThanOrEqual(65536);
  await p
    .locator('#import-file')
    .setInputFiles({name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{broken')});
  await expect(p.locator('#import-error')).not.toBeEmpty();
  await p.locator('#import-file').setInputFiles(file);
  await tap('[data-action="import-confirm"]');
  expect(await save()).toEqual(exported);
  await p.reload();
  await p.waitForSelector('.home');
  await p.clock.runFor(34);
  expect(await save()).toEqual(exported);
  await p.screenshot({path: `artifacts/${prefix}-home.png`});
  results.push({
    touchLayout: true,
    graphics: true,
    rotation: true,
    damageHints: true,
    isolatedRecords: true,
    saveRestore: true,
  });
  await c.close();
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await b.version(),
        environment: `Linux ${engine}; mobile 844x390 DPR2 emulation, actual input events + virtual clock; no physical device`,
        results,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
} finally {
  await b.close();
}
