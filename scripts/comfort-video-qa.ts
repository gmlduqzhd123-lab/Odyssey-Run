import {chromium, expect} from '@playwright/test';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const phase = process.env.QA_PHASE || 'after',
  url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const temporary = await mkdtemp(join(tmpdir(), 'odyssey-comfort-video-')),
  results: any[] = [],
  errors: string[] = [];
try {
  for (const device of [
    {name: 'desktop', width: 1280, height: 800, mobile: false},
    {name: 'mobile', width: 844, height: 390, mobile: true},
  ]) {
    const c = await browser.newContext({
      viewport: {width: device.width, height: device.height},
      deviceScaleFactor: 2,
      hasTouch: device.mobile,
      isMobile: device.mobile,
      recordVideo: {dir: temporary, size: {width: 960, height: 600}},
    });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
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
    const metrics = p.evaluate(
      `new Promise(resolve=>{const stamps=[];const start=performance.now();function frame(t){stamps.push(t);if(t-start<10000){requestAnimationFrame(frame);return;}const intervals=stamps.slice(1).map((v,i)=>v-stamps[i]).sort((a,b)=>a-b);resolve({elapsedMs:t-start,fps:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],distance:Number(document.querySelector('#progress').dataset.distance)});}requestAnimationFrame(frame);})`,
    );
    await p.waitForTimeout(1500);
    await p.keyboard.press('Space');
    await p.waitForTimeout(1700);
    await p.keyboard.down('ArrowDown');
    await p.waitForTimeout(1000);
    await p.screenshot({path: `artifacts/comfort-${phase}-${device.name}-crouch.png`});
    await p.waitForTimeout(600);
    await p.keyboard.up('ArrowDown');
    const timing = await metrics;
    await p.keyboard.press('p');
    await expect(p.locator('[data-action="resume"]')).toBeVisible();
    const video = p.video()!;
    await c.close();
    const file = `artifacts/comfort-${phase}-${device.name}.webm`;
    await video.saveAs(file);
    results.push({device, dpr: 2, video: file, metrics: timing});
    console.log(phase, device.name, JSON.stringify(timing));
  }
  expect(errors).toEqual([]);
  await writeFile(
    `artifacts/comfort-video-${phase}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment:
          'Linux headless Chromium; mobile emulation; real-time recording, no virtual clock; first 10s same viewport/input schedule; includes loading/countdown before gameplay; recording overhead included',
        results,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await rm(temporary, {recursive: true, force: true});
}
