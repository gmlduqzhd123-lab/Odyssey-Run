import {webkit, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b = await webkit.launch(),
  errors: string[] = [],
  failures: string[] = [],
  results: any[] = [];
try {
  const c = await b.newContext({
    viewport: {width: 844, height: 390},
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await c.addInitScript(() => {
    const create = AudioContext.prototype.createBufferSource;
    (window as any).__music = [];
    AudioContext.prototype.createBufferSource = function () {
      const ctx = this,
        node = create.call(this),
        start = node.start.bind(node),
        stop = node.stop.bind(node);
      let entry: any;
      node.start = ((...a: any[]) => {
        const output = (start as any)(...a);
        entry = {
          duration: node.buffer?.duration,
          offset: a[1] || 0,
          loop: node.loop,
          started: ctx.currentTime,
          stopped: false,
        };
        (window as any).__music.push(entry);
        return output;
      }) as typeof node.start;
      node.stop = ((...a: any[]) => {
        if (entry) {
          entry.stopped = true;
          entry.ended = ctx.currentTime;
        }
        return (stop as any)(...a);
      }) as typeof node.stop;
      return node;
    };
  });
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await p.goto('http://localhost:4176/Odyssey-Run/');
  await p.waitForSelector('.home');
  const entries = () => p.evaluate(() => (window as any).__music as any[]);
  await p.locator('[data-action="settings"]').tap();
  await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');
  await p.locator('[data-action="import-confirm"]').tap();
  await p.locator('[data-setting="music"]').check();
  await p.locator('[data-action="home"]').tap();
  await p.locator('[data-action="islands"]').first().tap();
  for (const [id, duration] of [
    ['beach', 162.144],
    ['cave', 108],
    ['wind', 96.912],
  ] as const) {
    console.log('WebKit real audio begins', id);
    await p.locator(`[data-action="stage:${id}"]`).tap();
    await p.locator('[data-action="start"]').tap();
    await p.waitForSelector('.countdown', {state: 'detached'});
    await p.waitForFunction(() => {
      const e = (window as any).__music;
      return e.length && e.at(-1).stopped === false;
    });
    await p.waitForTimeout(600);
    const first = (await entries()).at(-1)!;
    expect(first.loop).toBe(true);
    expect(first.duration).toBeCloseTo(duration, 0);
    await p.locator('[data-action="pause"]').tap();
    const prior = (await entries()).at(-1)!;
    expect(prior.stopped).toBe(true);
    await p.waitForTimeout(300);
    await p.locator('[data-action="resume"]').tap();
    await p.waitForSelector('.countdown', {state: 'detached'});
    await p.waitForTimeout(200);
    const resumed = (await entries()).at(-1)!;
    expect(resumed.offset).toBeCloseTo(prior.offset + prior.ended - prior.started, 1);
    expect((await entries()).filter(e => !e.stopped).length).toBe(1);
    await p.locator('[data-action="pause"]').tap();
    await p.locator('[data-action="islands"]').tap();
    results.push({id, first, prior, resumed});
  }
  await p.locator('[data-action="home"]').tap();
  await p.locator('[data-action="quit"]').tap();
  expect((await entries()).filter(e => !e.stopped)).toHaveLength(0);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    'artifacts/music-webkit-real-results.json',
    JSON.stringify(
      {
        browser: await b.version(),
        checkedAt: new Date().toISOString(),
        environment:
          'Linux WebKit mobile emulation 844x390 DPR2, real game clock, actual AudioBufferSource starts/stops; no speaker listening',
        results,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log('WebKit real-time three-track decode/play/resume/stop passed');
} finally {
  await b.close();
}
