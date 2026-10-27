import {chromium, webkit, expect} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import {routeInputs} from './check-routes';
import {VARIANT_LABELS} from '../src/levels/variants';
import {courseKey, type VariantId} from '../src/levels/course-ids';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  production = url.startsWith('https:'),
  engine = process.env.QA_ENGINE || 'chromium',
  smoke = process.env.QA_SMOKE === '1';
const b = await (engine === 'webkit' ? webkit : chromium).launch({
  ...(engine === 'chromium' ? {executablePath: '/usr/bin/chromium', args: ['--no-sandbox']} : {}),
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
const errors: string[] = [],
  failures: string[] = [],
  results: any[] = [];
const prefix = `variants-${production ? 'deployed-' : ''}${engine}${smoke ? '-smoke' : ''}`;
try {
  for (const mobile of engine === 'webkit' ? [true] : [false, true]) {
    const c = await b.newContext({
      viewport: mobile ? {width: 844, height: 390} : {width: 960, height: 620},
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
      acceptDownloads: true,
    });
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await p.clock.install();
    const response = await p.goto(url);
    await p.waitForSelector('.home');
    await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
    const bundle = await p.locator('script[type="module"]').getAttribute('src');
    expect(bundle).toBe(
      (await readFile('dist/index.html', 'utf8')).match(/<script(?=[^>]*type="module")[^>]*src="([^"]+)"/)![1],
    );
    const click = async (s: string) => (mobile ? p.locator(s).first().tap() : p.locator(s).first().click());
    const ready = async () => {
      while (await p.locator('.countdown').count()) await p.clock.runFor(17);
    };
    const distance = async () => Number(await p.locator('#progress').getAttribute('data-distance'));
    const advance = async (x: number) => {
      let guard = 0;
      while ((await distance()) < x && guard++ < 12) {
        await expect(p.locator('.result')).toHaveCount(0);
        await p.clock.runFor(Math.max(17, Math.ceil(((x - (await distance())) / 320) * 1000)));
      }
      expect(await distance()).toBeGreaterThanOrEqual(x);
    };
    const records = async () =>
      p.evaluate(() => {
        const k = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
        return JSON.parse(localStorage.getItem(k)!);
      });
    await click('[data-action="settings"]');
    await p.locator('[data-setting="music"]').uncheck();
    await p.locator('[data-setting="sfx"]').uncheck();
    await click('[data-action="home"]');
    await click('[data-action="islands"]');
    await expect(p.locator('[data-action="stage:cave"]')).toBeDisabled();
    const session = mobile && engine === 'chromium' ? await c.newCDPSession(p) : null;
    let held: any = null;
    const point = async (type: string, id: number) => {
      const box = (await p.locator(`[data-control="${type}"]`).boundingBox())!;
      return {id, x: box.x + box.width / 2, y: box.y + box.height / 2};
    };
    const input = async (type: string) => {
      if (!mobile || !session) {
        if (type === 'jump') await p.keyboard.press('Space');
        else if (type === 'down') await p.keyboard.down('ArrowDown');
        else await p.keyboard.up('ArrowDown');
        return;
      }
      if (type === 'jump') {
        const j = await point('jump', 22);
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: held ? [held, j] : [j]});
        await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held ? [held] : []});
      } else if (type === 'down') {
        held = await point('slide', 11);
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [held]});
      } else {
        held = null;
        await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
      }
    };
    const plans = smoke
      ? [['beach', 'remix-a'] as const]
      : mobile
        ? (['beach', 'cave', 'wind'] as const).flatMap(s => (['remix-a', 'remix-b'] as const).map(v => [s, v] as const))
        : (['beach', 'cave', 'wind'] as const).map(s => [s, 'remix-a'] as const);
    const runs = [];
    for (const [stage, variant] of plans) {
      console.log(prefix, mobile ? 'mobile' : 'desktop', 'begins', stage, variant);
      await click(`[data-action="stage:${stage}"]`);
      await expect(p.locator('.course-picker input')).toHaveCount(3);
      const choice = p.locator('.course-picker label').filter({has: p.locator(`input[value="${variant}"]`)});
      if (mobile) await choice.tap();
      else if (smoke) {
        await p.locator('input[name="course"][value="classic"]').focus();
        await p.keyboard.press('ArrowRight');
      } else await p.locator(`input[name="course"][value="${variant}"]`).check();
      await expect(p.locator(`input[name="course"][value="${variant}"]`)).toBeChecked();
      await p.locator('input[name="goal"][value="story"]').check();
      await choice.scrollIntoViewIfNeeded();
      await p.screenshot({path: `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-${stage}-${variant}-picker.png`});
      if (!mobile && smoke) {
        await p.locator('[data-action="start"]').focus();
        await p.keyboard.press('Enter');
      } else await click('[data-action="start"]');
      await ready();
      held = null;
      await expect(p.locator('#progress')).toHaveAttribute('data-course', courseKey(stage, variant));
      await expect(p.locator('#ghost-marker')).toBeHidden();
      if (runs.length === 0) {
        await p.clock.runFor(500);
        await click('[data-action="pause"]');
        const x = await distance();
        await p.clock.runFor(11000);
        expect(await distance()).toBe(x);
        await click('[data-action="resume"]');
        await ready();
      }
      const plan = routeInputs(stage, 'upper', true, variant),
        events = [
          ...plan.jumps.map(x => ({x, type: 'jump'})),
          ...plan.slides.flatMap(s => [
            {x: s.start, type: 'down'},
            {x: s.end, type: 'up'},
          ]),
        ].sort((a, b) => a.x - b.x);
      for (const event of events) {
        if (smoke && event.x > 6000) break;
        await advance(event.x);
        await input(event.type);
      }
      if (smoke) {
        await advance(6000);
        await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
        await p.screenshot({path: `artifacts/${prefix}-play.png`});
        await click('[data-action="pause"]');
        await click('[data-action="islands"]');
        break;
      }
      await advance(23400);
      await p.clock.runFor(2500);
      await expect(p.locator('.result')).toBeVisible();
      await expect(p.locator('.result')).toContainText('HP 손실 0회');
      await expect(p.locator('.course-result-label')).toHaveText(VARIANT_LABELS[stage][variant].name);
      const save = await records(),
        record = save.courses[courseKey(stage, variant)];
      expect(record.complete).toBe(true);
      expect(record.maps).toHaveLength(3);
      expect(save.stages[stage].maps).toHaveLength(3);
      expect(save.journal.ghosts[stage]).toBeUndefined();
      expect(save.courses[courseKey(stage, 'classic')]).toBeUndefined();
      runs.push({stage, variant, record});
      await p.screenshot({path: `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-${stage}-${variant}-result.png`});
      if (runs.length === 1) {
        await click('[data-action="restart"]');
        await expect(p.locator('#progress')).toHaveAttribute('data-course', courseKey(stage, variant));
        await expect(p.locator('#score')).toHaveText('0');
        await expect(p.locator('#hp')).toHaveAttribute('aria-label', '체력 3');
        await click('.countdown [data-action="pause"]');
        await click('[data-action="islands"]');
      } else await click('[data-action="islands"]');
      if (stage === 'beach') await expect(p.locator('[data-action="stage:cave"]')).toBeEnabled();
    }
    if (!smoke) {
      await click('[data-action="home"]');
      await click('[data-action="settings"]');
      const download = p.waitForEvent('download');
      await click('[data-action="export"]');
      const file = `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-save.json`;
      await (await download).saveAs(file);
      const save = await records();
      await p.locator('#import-file').setInputFiles(file);
      await click('[data-action="import-confirm"]');
      await p.reload();
      await p.waitForSelector('.home');
      expect(await records()).toEqual(save);
      await click('[data-action="islands"]');
      await click('[data-action="stage:beach"]');
      await expect(p.locator('.course-picker label').filter({has: p.locator('input[value="classic"]')})).toContainText(
        '최고 0',
      );
      await p.locator('input[name="course"][value="remix-a"]').check();
      await click('[data-action="start"]');
      await ready();
      await expect(p.locator('#ghost-marker')).toBeVisible();
      await click('[data-action="pause"]');
      await click('[data-action="islands"]');
    }
    results.push({mobile, bundle, status: response?.status(), runs});
    await c.close();
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        browser: await b.version(),
        checkedAt: new Date().toISOString(),
        environment: `Linux ${engine}, desktop 960x620 DPR1 keyboard / mobile 844x390 DPR2 emulation with CDP multi-pointer touch in Chromium; virtual game clock; no physical phone`,
        scope: smoke
          ? 'Menu course selection, pause/resume and first 6000px only'
          : 'Three new courses on desktop, all six new courses on mobile; no coordinate, HP or collectible state changes',
        results,
        errors,
        failures,
      },
      null,
      2,
    ),
  );
  console.log(prefix, 'passed');
} finally {
  await b.close();
}
