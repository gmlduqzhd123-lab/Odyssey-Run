import {chromium, expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/';
const mobile = process.env.QA_MOBILE === '1',
  prefix = mobile ? 'mobile-realtime' : 'realtime';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const errors: string[] = [],
  failures: string[] = [];
try {
  const p = await browser.newPage({
    viewport: mobile ? {width: 844, height: 390} : {width: 1280, height: 800},
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
  });
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.locator('[data-action="settings"]').click();
  await p.locator('[data-setting="music"]').uncheck();
  await p.locator('[data-setting="sfx"]').uncheck();
  await p.locator('[data-action="home"]').click();
  await p.locator('[data-action="islands"]').first().click();
  await p.locator('[data-action="stage:beach"]').click();
  await p.locator('[data-action="start"]').click();
  await p.waitForSelector('.countdown', {state: 'detached'});
  const frameMetrics = p.evaluate(
    `new Promise(resolve=>{const frames=[];const start=performance.now();function frame(t){frames.push(t);if(t-start<10000){requestAnimationFrame(frame);return;}const dt=frames.slice(1).map((v,i)=>v-frames[i]).sort((a,b)=>a-b);resolve({fps:(frames.length-1)*1000/(frames.at(-1)-frames[0]),p95FrameMs:dt[Math.floor(dt.length*.95)]});}requestAnimationFrame(frame);})`,
  );
  const session = mobile ? await p.context().newCDPSession(p) : null;
  const slidePoint = async () => {
    const b = (await p.locator('[data-control="slide"]').boundingBox())!;
    return {id: 11, x: b.x + b.width / 2, y: b.y + b.height / 2};
  };
  const start = Date.now(),
    plan = routeInputs('beach');
  const distance = async () => Number(await p.locator('#progress').getAttribute('data-distance'));
  const advance = async (target: number) => {
    while ((await distance()) < target) {
      if (await p.locator('.result').count()) throw Error('Run finished before the next input.');
      if (Date.now() - start > 100000) throw Error('Real-time run exceeded 100 seconds.');
      await p.waitForTimeout(Math.max(8, Math.min(200, ((target - (await distance())) / 320) * 1000 - 6)));
    }
  };
  const inputs = [
    ...plan.jumps.map(x => ({x, type: 'jump'})),
    ...plan.slides.flatMap(s => [
      {x: s.start, type: 'down'},
      {x: s.end, type: 'up'},
    ]),
  ].sort((a, b) => a.x - b.x);
  for (const input of inputs) {
    await advance(input.x);
    if (mobile) {
      if (input.type === 'jump') {
        const b = (await p.locator('[data-control="jump"]').boundingBox())!;
        await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      } else
        await session!.send('Input.dispatchTouchEvent', {
          type: input.type === 'down' ? 'touchStart' : 'touchEnd',
          touchPoints: input.type === 'down' ? [await slidePoint()] : [],
        });
    } else if (input.type === 'jump') await p.keyboard.press('Space');
    else if (input.type === 'down') await p.keyboard.down('ArrowDown');
    else await p.keyboard.up('ArrowDown');
  }
  await advance(23500);
  await p.screenshot({path: `artifacts/${prefix}-play.png`});
  await p.waitForSelector('.result');
  const elapsedMs = Date.now() - start;
  await expect(p.locator('.result')).toContainText('멋진 항해였어요!');
  await expect(p.locator('.result')).toContainText('HP 손실 0회');
  await expect(p.locator('.result')).toContainText('영구 지도 3/3');
  await p.screenshot({path: `artifacts/${prefix}-result.png`});
  const record = await p.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
    return JSON.parse(localStorage.getItem(key)!).stages.beach;
  });
  expect(record.complete).toBe(true);
  expect(record.bestRating).toBe(3);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment: mobile
          ? 'Linux Chromium mobile emulation 844x390 DPR2; actual taps and held CDP touch; no virtual clock or player-state mutation'
          : 'Linux Chromium desktop 1280x800 DPR2; actual keyboard events; no virtual clock',
        frameMetrics: await frameMetrics,
        elapsedMs,
        record,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log('Real-time beach complete:', JSON.stringify({elapsedMs, record}));
} finally {
  await browser.close();
}
