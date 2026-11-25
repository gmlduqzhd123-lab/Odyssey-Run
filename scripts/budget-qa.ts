import {chromium} from '@playwright/test';
import {existsSync, readFileSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {routeInputs} from './check-routes';
import {chaseFor} from '../src/levels/play-dynamics';
import {STORM_SPEED} from '../src/levels/weather';
import {getCourse} from '../src/levels/variants';
import {SaveStore, mergeResult} from '../src/storage/save';
// Low-end classroom devices: the built bundle and offline core stay inside a budget, and with the
// CPU slowed four times (a budget Chromebook) the home screen opens and a run keeps its pace, also
// where the effects pile up: a storm, the chase scene and fever time on the same stretch.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  BUDGET = {indexGzipKB: 128, coreMB: 3.5, homeMs: 9000, paceShare: 0.7, p95FrameMs: 150},
  results: Record<string, unknown> = {},
  problems: string[] = [];
// Every script the page loads at start (the entry and the chunks it imports), Phaser aside: it
// keeps its own cached file. Summed, so splitting code into more files cannot hide growth.
const startup = [...readFileSync('dist/index.html', 'utf8').matchAll(/assets\/([^"]+\.js)/g)]
    .map(m => m[1])
    .filter((f, i, all) => !f.startsWith('phaser-') && all.indexOf(f) === i),
  index = startup.join(' + '),
  indexGzipKB = startup.reduce((n, f) => n + gzipSync(readFileSync(`dist/assets/${f}`)).length, 0) / 1024,
  manifest = JSON.parse(readFileSync('dist/offline-manifest.json', 'utf8')) as {core: {bytes: number}[]},
  coreMB = manifest.core.reduce((n, f) => n + f.bytes, 0) / 1048576;
results.bundle = {index, indexGzipKB: Math.round(indexGzipKB), coreMB: Math.round(coreMB * 100) / 100};
if (indexGzipKB > BUDGET.indexGzipKB)
  problems.push(`startup scripts ${indexGzipKB.toFixed(0)}KB gzip > ${BUDGET.indexGzipKB}KB`);
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
  results.busy = await busyStretch();
} finally {
  await b.close();
}
results.budget = BUDGET;
// The beach is complete (the storm opens); the run is steered by the route plan at full speed to
// the chase (and fever time), then measured with the CPU slowed.
async function busyStretch() {
  const mem = new Map<string, string>(),
    store = new SaveStore(
      {getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: k => void mem.delete(k)},
      'save',
    );
  store.data = mergeResult(store.data, {
    stage: 'beach',
    complete: true,
    score: 3000,
    rating: 1,
    stars: 0,
    maps: [],
    hpLoss: 1,
    distance: 24000,
  });
  store.persist();
  const saveKey = `odyssey-run:${new URL(url).pathname}:save`,
    c = await b.newContext({viewport: {width: 1366, height: 768}, serviceWorkers: 'block'});
  await c.addInitScript(([k, v]) => localStorage.getItem(k) || localStorage.setItem(k, v), [saveKey, mem.get('save')!]);
  const p = await c.newPage(),
    errors: string[] = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url);
  await p.waitForSelector('.home', {timeout: 60000});
  await p.locator('[data-action="islands"]:visible').first().click();
  await p.locator('[data-action="stage:beach"]').click();
  await p.waitForSelector('[data-action="start"]');
  await p.locator('input[name="weather"][value="storm"]').check({force: true});
  const plan = routeInputs('beach', 'upper', true),
    events = [
      ...plan.jumps.map(x => ({x, type: 'jump'})),
      ...plan.slides.flatMap(s => [
        {x: s.start, type: 'down'},
        {x: s.end, type: 'up'},
      ]),
    ].sort((a, b) => a.x - b.x),
    chase = chaseFor(getCourse('beach', 'classic')),
    x = async () => Number((await p.locator('#progress').getAttribute('data-distance')) ?? -1);
  // The hero is steered in the page from the start, once per frame, by the planned positions.
  await p.evaluate(plan => {
    const w = window as unknown as {pilot: () => void},
      todo = [...plan];
    w.pilot = () => {
      const at = Number(document.querySelector<HTMLElement>('#progress')?.dataset.distance ?? 0);
      while (todo.length && at >= todo[0].x) {
        const e = todo.shift()!,
          code = e.type === 'jump' ? 'Space' : 'ArrowDown';
        if (e.type !== 'up') window.dispatchEvent(new KeyboardEvent('keydown', {code, bubbles: true}));
        if (e.type !== 'down') window.dispatchEvent(new KeyboardEvent('keyup', {code, bubbles: true}));
      }
      requestAnimationFrame(w.pilot);
    };
    requestAnimationFrame(w.pilot);
  }, events);
  await p.locator('[data-action="start"]').click();
  // At full speed to the chase, then on to fever time if a full gauge comes before the chase ends.
  await p.waitForFunction(
    t => Number(document.querySelector<HTMLElement>('#progress')?.dataset.distance ?? 0) >= t,
    chase.start + 400,
    {timeout: 90000},
  );
  await p
    .waitForFunction(
      t =>
        !!document.querySelector('#fever.on') ||
        Number(document.querySelector<HTMLElement>('#progress')?.dataset.distance ?? 0) >= t,
      chase.end - 2200,
      {timeout: 30000},
    )
    .catch(() => {});
  const fever = (await p.locator('#fever.on').count()) > 0,
    from = await x();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', {rate: 4});
  const run = (await p.evaluate(
    `new Promise(resolve => {
      const stamps = [], start = performance.now();
      function frame(t) {
        stamps.push(t);
        if (t - start < 6000) return requestAnimationFrame(frame);
        const gaps = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b);
        resolve({seconds: (t - start) / 1000, fps: (stamps.length - 1) * 1000 / (t - stamps[0]),
          p95FrameMs: gaps[Math.floor(gaps.length * 0.95)],
          distance: Number(document.querySelector('#progress')?.dataset.distance ?? -1)});
      }
      requestAnimationFrame(frame);
    })`,
  )) as {seconds: number; fps: number; p95FrameMs: number; distance: number};
  await c.close();
  if (run.distance < from) problems.push('busy stretch: the run ended before it was measured');
  // The storm's headwind is part of the pace; the game slows down rather than skipping ahead.
  const pace = (run.distance - from) / (run.seconds * 320 * STORM_SPEED);
  if (pace < BUDGET.paceShare) problems.push(`busy stretch pace ${pace.toFixed(2)} < ${BUDGET.paceShare}`);
  if (run.p95FrameMs > BUDGET.p95FrameMs)
    problems.push(`busy stretch p95 frame ${run.p95FrameMs.toFixed(0)}ms > ${BUDGET.p95FrameMs}ms`);
  if (errors.length) problems.push(`busy stretch page errors: ${errors.join(' | ')}`);
  return {
    cpuSlowdown: 4,
    weather: 'storm',
    chase: [chase.start, chase.end],
    fever,
    from,
    ...run,
    pace: Math.round(pace * 100) / 100,
    errors,
  };
}
results.problems = problems;
await writeFile('artifacts/budget-results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
if (problems.length) throw Error('budget: ' + problems.join('; '));
console.log('budget: bundle, offline core, low-end load, run pace and the busy stretch within budget');
