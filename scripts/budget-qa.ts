import {chromium} from '@playwright/test';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
// Low-end classroom devices: the built bundle and offline core stay inside a budget, and with the
// CPU slowed four times (a budget Chromebook) the home screen opens and a run keeps its pace.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  BUDGET = {indexGzipKB: 140, coreMB: 3.5, homeMs: 9000, paceShare: 0.7, p95FrameMs: 150},
  results: Record<string, unknown> = {},
  problems: string[] = [];
const index = readdirSync('dist/assets').find(f => /^index-.*\.js$/.test(f))!,
  indexGzipKB = gzipSync(readFileSync(`dist/assets/${index}`)).length / 1024,
  manifest = JSON.parse(readFileSync('dist/offline-manifest.json', 'utf8')) as {core: {bytes: number}[]},
  coreMB = manifest.core.reduce((n, f) => n + f.bytes, 0) / 1048576;
results.bundle = {index, indexGzipKB: Math.round(indexGzipKB), coreMB: Math.round(coreMB * 100) / 100};
if (indexGzipKB > BUDGET.indexGzipKB)
  problems.push(`main script ${indexGzipKB.toFixed(0)}KB gzip > ${BUDGET.indexGzipKB}KB`);
if (coreMB > BUDGET.coreMB) problems.push(`offline core ${coreMB.toFixed(2)}MB > ${BUDGET.coreMB}MB`);
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
try {
  const c = await b.newContext({viewport: {width: 1366, height: 768}, serviceWorkers: 'block'}),
    p = await c.newPage(),
    errors: string[] = [];
  p.on('pageerror', e => errors.push(e.message));
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
  const started = Date.now();
  await p.goto(url);
  await p.waitForSelector('.home', {timeout: 60000});
  const homeMs = Date.now() - started;
  await p.locator('[data-action="islands"]:visible').first().click();
  await p.locator('[data-action="stage:beach"]').click();
  await p.waitForSelector('[data-action="start"]', {timeout: 60000});
  await p.locator('[data-action="start"]').click();
  await p.waitForSelector('.countdown', {state: 'detached', timeout: 30000});
  const run = (await p.evaluate(
    `new Promise(resolve => {
      const stamps = [], start = performance.now(), from = Number(document.querySelector('#progress').dataset.distance);
      function frame(t) {
        stamps.push(t);
        if (t - start < 6000) return requestAnimationFrame(frame);
        const gaps = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b);
        resolve({seconds: (t - start) / 1000, fps: (stamps.length - 1) * 1000 / (t - stamps[0]),
          p95FrameMs: gaps[Math.floor(gaps.length * 0.95)],
          distance: Number(document.querySelector('#progress').dataset.distance) - from});
      }
      requestAnimationFrame(frame);
    })`,
  )) as {seconds: number; fps: number; p95FrameMs: number; distance: number};
  // The game clamps long frames, so a struggling device runs slow instead of skipping ahead.
  const pace = run.distance / (run.seconds * 320);
  results.lowEnd = {cpuSlowdown: 4, homeMs, ...run, pace: Math.round(pace * 100) / 100, errors};
  if (homeMs > BUDGET.homeMs) problems.push(`home screen ${homeMs}ms > ${BUDGET.homeMs}ms`);
  if (pace < BUDGET.paceShare) problems.push(`run pace ${pace.toFixed(2)} < ${BUDGET.paceShare}`);
  if (run.p95FrameMs > BUDGET.p95FrameMs)
    problems.push(`p95 frame ${run.p95FrameMs.toFixed(0)}ms > ${BUDGET.p95FrameMs}ms`);
  if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
} finally {
  await b.close();
}
results.budget = BUDGET;
results.problems = problems;
await writeFile('artifacts/budget-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
if (problems.length) throw Error('budget: ' + problems.join('; '));
console.log('budget: bundle, offline core, low-end load and run pace within budget');
