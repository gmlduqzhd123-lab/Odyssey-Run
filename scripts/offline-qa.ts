import {chromium, expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
import {STAGES} from '../src/levels/courses';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  prefix = process.env.QA_PREFIX || 'roadmap-offline',
  production = url.startsWith('https:');
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [],
  results: any[] = [];
try {
  const c = await b.newContext({
      viewport: {width: 844, height: 390},
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    }),
    p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true}),
      );
  });
  const tap = async (s: string) => p.locator(s).first().tap();
  await tap('[data-action="settings"]');
  await p.locator('[data-setting="music"]').uncheck();
  await p.locator('[data-setting="sfx"]').uncheck();
  await tap('[data-action="offline"]');
  await expect(p.locator('.offline-page')).toContainText('다운로드 준비됨', {timeout: 60000});
  for (const id of STAGES) {
    await tap(`[data-action="download-stage:${id}"]`);
    await expect(p.locator('.offline-page .daily-card [role="status"]')).toContainText('다운로드를 완료', {
      timeout: 120000,
    });
    await expect(
      p.locator('.trial-card').filter({has: p.locator(`[data-action="download-stage:${id}"]`)}),
    ).toContainText('오프라인 이용 가능');
  }
  await p.screenshot({path: `artifacts/${prefix}-downloaded.png`});
  const cachedBefore = await p.evaluate(async () => ({names: await caches.keys(), save: Object.entries(localStorage)}));
  expect(cachedBefore.names.some(n => n.startsWith('odyssey-run-v:'))).toBe(true);
  // A missing file must invalidate completion; it can be downloaded again.
  await p.evaluate(async () => {
    const names = await caches.keys(),
      name = names.find(n => n.endsWith('-beach') && n.startsWith('odyssey-run-v:'))!,
      cache = await caches.open(name),
      keys = await cache.keys();
    await cache.delete(keys[0]);
  });
  await tap('[data-action="offline-refresh"]');
  await expect(p.locator('.trial-card').first()).toContainText('아직 다운로드 전');
  await tap('[data-action="download-stage:beach"]');
  await expect(p.locator('.offline-page .daily-card [role="status"]')).toContainText('다운로드를 완료', {
    timeout: 120000,
  });
  await c.setOffline(true);
  await p.reload();
  await p.waitForSelector('.home');
  await tap('[data-action="settings"]');
  await tap('[data-action="offline"]');
  await expect(p.locator('.offline-page')).toContainText('오프라인 상태');
  await expect(p.locator('.trial-card').first()).toContainText('오프라인 이용 가능');
  await tap('[data-action="settings"]');
  await tap('[data-action="home"]');
  await p.clock.install();
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
  const countdown = async () => {
    while (await p.locator('.countdown').count()) await p.clock.runFor(17);
  };
  const x = async () => Number(await p.locator('#progress').getAttribute('data-distance'));
  const advance = async (target: number) => {
    while ((await x()) < target) {
      await expect(p.locator('.result')).toHaveCount(0);
      await p.clock.runFor(Math.max(17, Math.ceil(((target - (await x())) / 320) * 1000)));
    }
  };
  const cd = await c.newCDPSession(p);
  let held: any = null;
  const point = async (type: string, id: number) => {
    const r = (await p.locator(`[data-control="${type}"]`).boundingBox())!;
    return {id, x: r.x + r.width / 2, y: r.y + r.height / 2};
  };
  for (const id of STAGES) {
    await tap('[data-action="islands"]');
    await tap(`[data-action="stage:${id}"]`);
    await tap('[data-action="start"]');
    await countdown();
    const plan = routeInputs(id, 'upper', true),
      events = [
        ...plan.jumps.map(x => ({x, type: 'jump'})),
        ...plan.slides.flatMap(s => [
          {x: s.start, type: 'down'},
          {x: s.end, type: 'up'},
        ]),
      ].sort((a, b) => a.x - b.x);
    for (const e of events) {
      await advance(e.x);
      if (e.type === 'jump') {
        const j = await point('jump', 22);
        await cd.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: held ? [held, j] : [j]});
        await cd.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held ? [held] : []});
      } else if (e.type === 'down') {
        held = await point('slide', 11);
        await cd.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [held]});
      } else {
        held = null;
        await cd.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      }
    }
    await advance(23700);
    await p.clock.runFor(1800);
    await expect(p.locator('.result')).toContainText('HP 손실 0회');
    results.push({offlineComplete: id});
    await p.screenshot({path: `artifacts/${prefix}-${id}-result.png`});
    await tap('[data-action="islands"]');
    await tap('[data-action="home"]');
    console.log('offline course passed', id);
  }
  await c.setOffline(false);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await b.version(),
        environment:
          'Linux Chromium, mobile emulation, actual service worker and CacheStorage; context offline mode + virtual game clock; no physical device',
        downloadedAll: true,
        evictionDetected: true,
        results,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  await c.close();
  // A Vietnamese class device that never downloaded an island stays in Vietnamese offline.
  const v = await b.newContext({viewport: {width: 1280, height: 720}}),
    q = await v.newPage();
  q.on('pageerror', e => errors.push('vi: ' + e.message));
  await v.addInitScript(() => localStorage.setItem('odyssey-run:lang', 'vi'));
  await q.goto(url);
  await q.waitForSelector('.home');
  await q.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true}),
      );
  });
  await q.waitForFunction(
    async () => {
      const name = (await caches.keys()).find(n => n.startsWith('odyssey-run-lang:'));
      return name ? (await (await caches.open(name)).keys()).length >= 2 : false;
    },
    null,
    {timeout: 30000},
  );
  await v.setOffline(true);
  await q.reload();
  await q.waitForSelector('.home');
  await expect(q.locator('html')).toHaveAttribute('lang', 'vi');
  await expect(q.locator('h1')).not.toContainText('오디세이');
  results.push({offlineLanguage: 'vi', h1: await q.locator('h1').first().textContent()});
  console.log('offline language passed vi');
  await v.close();
  expect(errors).toEqual([]);
} finally {
  await b.close();
}
