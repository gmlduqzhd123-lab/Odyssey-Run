import {chromium, webkit, expect, type Page} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
import {STAGES} from '../src/levels/courses';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  phase = process.env.QA_PHASE || 'mobile-after',
  engine = process.env.QA_ENGINE || 'chromium',
  before = phase === 'mobile-before',
  production = url.startsWith('https:');
const browser = await (engine === 'webkit' ? webkit : chromium).launch({
  ...(engine === 'chromium' ? {executablePath: '/usr/bin/chromium', args: ['--no-sandbox']} : {}),
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [],
  results: any[] = [],
  routes: any[] = [];
const clockReady = async (p: Page) => {
  let i = 0;
  while ((await p.locator('.countdown').count()) && i++ < 250) await p.clock.runFor(17);
  await expect(p.locator('.countdown')).toHaveCount(0);
};
const distance = async (p: Page) => Number(await p.locator('#progress').getAttribute('data-distance'));
const actor = async (p: Page) => p.evaluate(() => (window as any).__mobileActor);
try {
  const profiles =
    process.env.QA_PROFILES === '0'
      ? []
      : process.env.QA_SIZE
        ? [process.env.QA_SIZE.split('x').map(Number)]
        : engine === 'webkit'
          ? [
              [568, 320],
              [844, 390],
              [390, 844],
            ]
          : [
              [568, 320],
              [667, 375],
              [740, 300],
              [844, 390],
              [932, 430],
              [1024, 600],
              [390, 844],
              [360, 640],
            ];
  for (const [width, height] of profiles) {
    const c = await browser.newContext({
      viewport: {width, height},
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await c.addInitScript(() => {
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      (window as any).__mobileActor = '';
      CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...a: any[]) {
        const s = a[0];
        if (this.canvas.parentElement?.id === 'game' && s instanceof HTMLImageElement) {
          if (s.naturalWidth === 768 && s.naturalHeight === 512) (window as any).__mobileActor = 'crouch';
          if (s.naturalWidth === 576 && s.naturalHeight === 768) (window as any).__mobileActor = 'air';
          if (s.naturalWidth === 1536 && s.naturalHeight === 1024) (window as any).__mobileActor = 'run';
        }
        return (draw as Function).apply(this, a);
      } as typeof draw;
    });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await p.clock.install();
    await p.goto(url);
    await p.waitForSelector('.home');
    await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
    const result: any = {width, height, dpr: 2};
    try {
      await p.locator('[data-action="islands"]').first().tap({timeout: 2500});
      result.startTouchable = true;
      await p.locator('[data-action="stage:beach"]').tap();
      await p.locator('[data-action="start"]').tap();
      if (height > width) {
        await expect(p.locator('#rotate')).toBeVisible();
        await p.clock.runFor(11000);
        expect(await distance(p)).toBe(0);
        await p.setViewportSize({width: 844, height: 390});
        await expect(p.locator('[data-action="resume"]')).toBeVisible();
        await p.locator('[data-action="resume"]').tap();
        result.portraitStartPaused = true;
      }
      await clockReady(p);
      for (const button of await p.locator('[data-control]').all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(64);
        expect(box.height).toBeGreaterThanOrEqual(64);
      }
      await p.locator('[data-control="jump"]').tap();
      await p.clock.runFor(100);
      expect(await actor(p)).toBe('air');
      await p.clock.runFor(900);
      expect(await actor(p)).toBe('run');
      if (engine === 'chromium') {
        const session = await c.newCDPSession(p),
          box = (await p.locator('[data-control="slide"]').boundingBox())!,
          jb = (await p.locator('[data-control="jump"]').boundingBox())!;
        const slide = {id: 11, x: box.x + box.width / 2, y: box.y + box.height / 2},
          jump = {id: 22, x: jb.x + jb.width / 2, y: jb.y + jb.height / 2};
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [jump]});
        await p.clock.runFor(1000);
        expect(await actor(p)).toBe('run');
        await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [slide]});
        await p.clock.runFor(34);
        expect(await actor(p)).toBe('crouch');
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [slide, jump]});
        await p.clock.runFor(100);
        expect(await actor(p)).toBe('air');
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {id: 11, x: 400, y: 180},
            {id: 22, x: 430, y: 180},
          ],
        });
        await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await p.clock.runFor(1000);
        expect(await actor(p)).toBe('run');
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [slide]});
        await session.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
        await p.clock.runFor(34);
        expect(await actor(p)).toBe('run');
        result.multiTouchOutsideCancel = true;
      }
      const x = await distance(p);
      await p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true})));
      await p.clock.runFor(11000);
      result.pagehidePauses = (await p.locator('[data-action="resume"]').isVisible()) && (await distance(p)) === x;
      if (!before) expect(result.pagehidePauses).toBe(true);
      if (result.pagehidePauses) {
        await p.locator('[data-action="resume"]').tap();
        await clockReady(p);
      }
      await p.setViewportSize({width: 390, height: 844});
      await expect(p.locator('#rotate')).toBeVisible();
      const frozen = await distance(p);
      await p.clock.runFor(11000);
      expect(await distance(p)).toBe(frozen);
      await p.setViewportSize({width: 844, height: 390});
      await expect(p.locator('[data-action="resume"]')).toBeVisible();
      await p.locator('[data-action="resume"]').tap();
      await clockReady(p);
      await p.setViewportSize({width: 844, height: 320});
      await p.setViewportSize({width: 844, height: 390});
      await p.locator('[data-control="jump"]').tap();
      await p.clock.runFor(100);
      expect(await actor(p)).toBe('air');
      result.resizeRotationTouch = true;
      await p.locator('[data-action="pause"]').tap();
      await p.locator('[data-action="restart"]').tap();
      await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
      await expect(p.locator('#score')).toHaveText('0');
      await p.locator('.countdown [data-action="pause"]').tap();
      await p.screenshot({path: `artifacts/${phase}-${engine}-${width}x${height}.png`});
      result.retry = true;
    } catch (e) {
      result.error = String(e).slice(0, 350);
      if (!before) throw e;
      console.log('reproduced', result.error);
      await p.screenshot({path: `artifacts/${phase}-${engine}-${width}x${height}-failure.png`}).catch(e => {
        result.captureError = String(e).slice(0, 200);
      });
    }
    results.push(result);
    await writeFile(
      `artifacts/${phase}-${engine}${process.env.QA_SIZE ? '-' + process.env.QA_SIZE : ''}-profiles.json`,
      JSON.stringify({url, browser: await browser.version(), results}, null, 2),
    );
    await c.close();
    console.log(engine, width, height, JSON.stringify(result));
  }
  if (!before && engine === 'chromium' && process.env.QA_ROUTES !== '0') {
    const c = await browser.newContext({
        viewport: {width: 844, height: 390},
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        acceptDownloads: true,
      }),
      p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await p.clock.install();
    await p.goto(url);
    await p.waitForSelector('.home');
    await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
    await p.locator('[data-action="islands"]').first().tap();
    const session = await c.newCDPSession(p);
    for (const id of STAGES) {
      await p.locator(`[data-action="stage:${id}"]`).tap();
      await p.locator('[data-action="start"]').tap();
      await clockReady(p);
      let held: any = null;
      const point = async (type: string, id: number) => {
        const b = (await p.locator(`[data-control="${type}"]`).boundingBox())!;
        return {id, x: b.x + b.width / 2, y: b.y + b.height / 2};
      };
      const plan = routeInputs(id),
        events = [
          ...plan.jumps.map(x => ({x, type: 'jump'})),
          ...plan.slides.flatMap(s => [
            {x: s.start, type: 'down'},
            {x: s.end, type: 'up'},
          ]),
        ].sort((a, b) => a.x - b.x);
      const advance = async (target: number) => {
        let guard = 0;
        while ((await distance(p)) < target && guard++ < 12)
          await p.clock.runFor(Math.max(17, Math.ceil(((target - (await distance(p))) / 320) * 1000)));
        expect(await distance(p)).toBeGreaterThanOrEqual(target);
      };
      for (const event of events) {
        await advance(event.x);
        if (event.type === 'jump') {
          const jump = await point('jump', 22);
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: held ? [held, jump] : [jump],
          });
          await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held ? [held] : []});
        } else if (event.type === 'down') {
          held = await point('slide', 11);
          await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [held]});
        } else {
          held = null;
          await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        }
      }
      await advance(23400);
      await p.clock.runFor(2500);
      await expect(p.locator('.result')).toBeVisible();
      await expect(p.locator('.result')).toContainText('HP 손실 0회');
      await expect(p.locator('.result')).toContainText('영구 지도 3/3');
      await p.screenshot({path: `artifacts/${phase}-touch-${id}-result.png`});
      routes.push({id, text: await p.locator('.result').innerText()});
      await p.locator('[data-action="islands"]').tap();
      console.log('mobile touch course complete:', id);
    }
    await p.reload();
    await p.waitForSelector('.home');
    await p.locator('[data-action="codex"]').tap();
    await expect(p.locator('.fragment.found')).toHaveCount(9);
    await p.locator('[data-action="home"]').tap();
    await p.locator('[data-action="settings"]').tap();
    const download = p.waitForEvent('download');
    await p.locator('[data-action="export"]').tap();
    await (await download).saveAs(`artifacts/${phase}-mobile-save.json`);
    const records = await p.evaluate(() => Object.entries(localStorage));
    await p.locator('#import-file').setInputFiles(`artifacts/${phase}-mobile-save.json`);
    await p.locator('[data-action="import-confirm"]').tap();
    expect((await p.evaluate(() => Object.entries(localStorage))).filter(([k]) => !k.endsWith(':backup'))).toEqual(
      records.filter(([k]) => !k.endsWith(':backup')),
    );
    await c.close();
  }
  if (!before) {
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
  }
  await writeFile(
    `artifacts/${phase}-${engine}${process.env.QA_SIZE ? '-' + process.env.QA_SIZE : ''}-results.json`,
    JSON.stringify(
      {
        url,
        browser: await browser.version(),
        checkedAt: new Date().toISOString(),
        environment:
          'Linux headless browser mobile emulation; no physical Android/iOS; touch events and virtual game clock; pagehide injected independently of visibility',
        results,
        routes,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
