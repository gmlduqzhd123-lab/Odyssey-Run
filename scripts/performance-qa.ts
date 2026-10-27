import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const results = [];
for (const renderer of ['Canvas']) {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  try {
    const p = await b.newPage({viewport: {width: 960, height: 620}});
    const errors: string[] = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(process.env.QA_URL || 'http://localhost:4174/qa-odyssey/');
    await p.waitForSelector('.home');
    await p.locator('[data-action="islands"]').first().click();
    await p.locator('[data-action="stage:beach"]').click();
    await p.locator('[data-action="start"]').click();
    await p.waitForSelector('.countdown', {state: 'detached'});
    const metrics = await p.evaluate(
      `new Promise(resolve=>{const stamps=[];const start=performance.now();const distance=Number(document.querySelector('#progress').dataset.distance);function frame(t){stamps.push(t);if(t-start<10000){requestAnimationFrame(frame);return;}const elapsed=t-start;const intervals=stamps.slice(1).map((v,i)=>v-stamps[i]).sort((a,b)=>a-b);resolve({canvas2D:!!document.querySelector('canvas').getContext('2d'),elapsedMs:elapsed,frames:stamps.length,fps:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],distance:Number(document.querySelector('#progress').dataset.distance)-distance});}requestAnimationFrame(frame);})`,
    );
    results.push({
      renderer,
      viewport: '960x620; logical 960x540',
      environment: 'Linux headless Chromium, software graphics, no physical device',
      browser: await b.version(),
      metrics,
      errors,
    });
    console.log(renderer, JSON.stringify(metrics));
    await p.screenshot({path: `artifacts/performance-${renderer.toLowerCase()}.png`});
  } finally {
    await b.close();
  }
}
await writeFile('artifacts/performance-results.json', JSON.stringify(results, null, 2));
