import {createServer} from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';
import {chromium, expect} from '@playwright/test';
import {existsSync} from 'node:fs';
const original = JSON.parse(await readFile('dist/offline-manifest.json', 'utf8')),
  sw = await readFile('dist/sw.js', 'utf8'),
  versionA = original.version,
  versionB = 'test000000000002',
  versionC = 'test000000000003';
let revision = versionA,
  deny = false;
const root = resolve('dist'),
  base = '/Odyssey-Run/';
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url!, 'http://localhost').pathname;
    if (!pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    const name = decodeURIComponent(pathname.slice(base.length)) || 'index.html',
      path = resolve(root, name);
    if (!path.startsWith(root + '/')) {
      res.writeHead(403).end();
      return;
    }
    if (deny && name === 'assets/crate.svg') {
      res.writeHead(503, {'Content-Type': 'text/plain'}).end('injected unavailable file');
      return;
    }
    const types: Record<string, string> = {
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.webmanifest': 'application/manifest+json',
      '.mp3': 'audio/mp3',
      '.png': 'image/png',
    };
    res.writeHead(200, {
      'Content-Type': types[extname(name)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(
      name === 'sw.js'
        ? sw.replaceAll(versionA, revision)
        : name === 'offline-manifest.json'
          ? JSON.stringify({...original, version: revision})
          : await readFile(path),
    );
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>(r => server.listen(4181, '127.0.0.1', r));
const url = 'http://localhost:4181' + base,
  b = await chromium.launch({
    executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
const results: any[] = [];
try {
  const c = await b.newContext({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true}),
    p = await c.newPage();
  const errors: string[] = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url + 'manifest.webmanifest');
  await p.evaluate(async () => {
    const cache = await caches.open('odyssey-run-v1');
    await cache.put(new URL('./assets/legacy-old.svg', location.href).href, new Response('old game asset'));
    await cache.put(new URL('/another-app/keep.txt', location.href).href, new Response('keep foreign asset'));
  });
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(r =>
        navigator.serviceWorker.addEventListener('controllerchange', () => r(), {once: true}),
      );
  });
  const legacy = await p.evaluate(async () => {
    const cache = await caches.open('odyssey-run-v1');
    return {
      own: !!(await cache.match(new URL('./assets/legacy-old.svg', location.href).href)),
      foreign: await (await cache.match(new URL('/another-app/keep.txt', location.href).href))?.text(),
    };
  });
  expect(legacy).toEqual({own: false, foreign: 'keep foreign asset'});
  results.push({legacyAppAssetsRemoved: true, foreignLegacyCachePreserved: true});
  const tap = async (s: string) => p.locator(s).first().tap();
  await tap('[data-action="settings"]');
  await p.locator('[data-setting="music"]').uncheck();
  await p.locator('[data-setting="sfx"]').uncheck();
  await p.evaluate(() => localStorage.setItem('another-app', 'keep'));
  let saved = await p.evaluate(() => Object.entries(localStorage));
  await tap('[data-action="offline"]');
  await expect(p.locator('.offline-page')).toContainText('다운로드 준비됨');
  deny = true;
  await tap('[data-action="download-stage:beach"]');
  await expect(p.locator('.offline-page .daily-card [role="status"]')).toContainText('완료하지 못', {timeout: 60000});
  await expect(p.locator('.trial-card').first()).toContainText('아직 다운로드 전');
  expect(await p.evaluate(() => Object.entries(localStorage))).toEqual(saved);
  deny = false;
  results.push({failedDownloadPreservesSave: true, partialDownloadNotMarkedComplete: true});
  await tap('[data-action="download-stage:beach"]');
  await expect(p.locator('.trial-card').first()).toContainText('오프라인 이용 가능', {timeout: 120000});
  saved = await p.evaluate(() => Object.entries(localStorage));
  // A second tab is already open when the new version arrives (a tab opened afterwards would
  // apply it on start, which is checked at the end), and is mid-run when the update is tried.
  const p2 = await c.newPage();
  await p2.goto(url);
  await p2.waitForSelector('.home');
  revision = versionB;
  await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r!.update();
  });
  await expect
    .poll(() => p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), {timeout: 60000})
    .toBe(true);
  await p2.locator('[data-action="islands"]').first().tap();
  await p2.locator('[data-action="stage:beach"]').tap();
  await p2.locator('[data-action="start"]').tap();
  await p2.waitForSelector('.play-ui');
  saved = await p.evaluate(() => Object.entries(localStorage));
  await tap('[data-action="offline-refresh"]');
  await expect(p.locator('.daily-card')).toContainText('새 버전이 준비됐어요');
  await tap('[data-action="update"]');
  await expect(p.locator('.daily-card')).toContainText('다른 탭에서 항해', {timeout: 10000});
  expect(await p.evaluate(() => Object.entries(localStorage))).toEqual(saved);
  results.push({busyOtherTabBlocksUpdate: true});
  await p2.locator('[data-action="pause"]').first().tap();
  await p2.locator('[data-action="islands"]').tap();
  await p2.close();
  await tap('[data-action="update"]');
  await p.waitForSelector('.home', {timeout: 30000});
  await expect
    .poll(() => p.evaluate(() => caches.keys()), {timeout: 20000})
    .toContain('odyssey-run-v:/Odyssey-Run/:' + versionB + '-core');
  const names = await p.evaluate(() => caches.keys());
  expect(names.some(n => n.includes(versionA))).toBe(false);
  expect(await p.evaluate(() => Object.entries(localStorage))).toEqual(saved);
  results.push({idleUpdateReloads: true, oldScopedCachesRemoved: true, saveAndOtherAppPreserved: true});
  await tap('[data-action="settings"]');
  await tap('[data-action="offline"]');
  await expect(p.locator('.trial-card').first()).toContainText('오프라인 이용 가능', {timeout: 20000});
  results.push({unchangedDownloadedIslandSurvivesUpdate: true});
  // A version that finished downloading earlier is applied as soon as the game is opened again.
  revision = versionC;
  await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r!.update();
  });
  await expect
    .poll(() => p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting), {timeout: 60000})
    .toBe(true);
  const p3 = await c.newPage();
  p3.on('pageerror', e => errors.push(e.message));
  await p3.goto(url);
  await expect
    .poll(() => p3.evaluate(() => caches.keys()).catch(() => [] as string[]), {timeout: 30000})
    .toContain('odyssey-run-v:/Odyssey-Run/:' + versionC + '-core');
  await p3.waitForSelector('.home', {timeout: 30000});
  expect(await p3.evaluate(() => Object.entries(localStorage))).toEqual(saved);
  results.push({waitingVersionAppliedOnOpen: true});
  await p3.close();
  await p.screenshot({path: 'artifacts/roadmap-update.png'});
  expect(errors).toEqual([]);
  await writeFile(
    'artifacts/roadmap-update-results.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        browser: await b.version(),
        environment:
          'Linux Chromium mobile emulation; two real service worker revisions served locally on 4181; injected 503 is intentional; no production mutation',
        versionA,
        versionB,
        results,
        errors,
      },
      null,
      2,
    ),
  );
  await c.close();
} finally {
  await b.close();
  await new Promise<void>((r, e) => server.close(err => (err ? e(err) : r())));
}
