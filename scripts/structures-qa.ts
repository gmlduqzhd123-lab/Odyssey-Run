import {chromium, expect} from '@playwright/test';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {RUN_ART} from '../src/assets/runner-art';
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  production = url.startsWith('https:'),
  prefix = process.env.QA_PREFIX || (production ? 'structures-deployed' : 'structures'),
  results: any[] = [],
  errors: string[] = [],
  failures: string[] = [];
const browser = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
  ...(production ? {proxy: {server: process.env.HTTPS_PROXY || process.env.HTTP_PROXY!}} : {}),
});
try {
  for (const mobile of [false, true]) {
    const c = await browser.newContext({
      viewport: mobile ? {width: 844, height: 390} : {width: 1280, height: 800},
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
    });
    await c.addInitScript(
      ({frames}) => {
        const obs = {actor: null as any, messages: [] as string[]};
        (window as any).__structureQA = obs;
        const draw = CanvasRenderingContext2D.prototype.drawImage,
          fill = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (
          this: CanvasRenderingContext2D,
          ...args: Parameters<typeof fill>
        ) {
          if (!obs.messages.includes(args[0])) obs.messages.push(args[0]);
          return fill.apply(this, args);
        };
        CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...a: any[]) {
          const im = a[0];
          if (this.canvas.parentElement?.id === 'game' && im instanceof HTMLImageElement) {
            const crouch = im.naturalWidth === 768 && im.naturalHeight === 512,
              run =
                im.naturalWidth === 1536 && im.naturalHeight === 1024 && frames.some(f => f.x === a[1] && f.y === a[2]);
            if (crouch || run) {
              const m = this.getTransform(),
                rect = this.canvas.getBoundingClientRect(),
                scale = Math.min(rect.width / 960, rect.height / 540),
                density = this.canvas.width / (rect.width / scale);
              obs.actor = {crouched: crouch, feet: m.f / density - (rect.height / scale - 540)};
            }
          }
          return (draw as Function).apply(this, a);
        } as typeof draw;
      },
      {frames: RUN_ART.frames},
    );
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => {
      if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
    });
    await p.clock.install();
    await p.goto(url);
    await p.waitForSelector('.home');
    await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
    const click = async (s: string) => (mobile ? p.locator(s).first().tap() : p.locator(s).first().click());
    const x = async () => Number(await p.locator('#progress').getAttribute('data-distance')),
      hp = async () => p.locator('#hp').getAttribute('aria-label'),
      effects = async () => p.locator('#effects').innerText();
    const advance = async (target: number) => {
      let i = 0;
      while ((await x()) < target && i++ < 12) {
        await expect(p.locator('.result')).toHaveCount(0);
        await p.clock.runFor(Math.max(17, Math.ceil(((target - (await x())) / 320) * 1000)));
      }
      expect(await x()).toBeGreaterThanOrEqual(target);
    };
    const countdown = async () => {
      let i = 0;
      while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
      await expect(p.locator('.countdown')).toHaveCount(0);
    };
    const stored = () =>
      p.evaluate(() => {
        const k = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
        return JSON.parse(localStorage.getItem(k)!);
      });
    await click('[data-action="settings"]');
    await p.locator('[data-setting="music"]').uncheck();
    await p.locator('[data-setting="sfx"]').uncheck();
    await click('[data-action="home"]');
    await click('[data-action="islands"]');
    await click('[data-action="stage:beach"]');
    await click('[data-action="start"]');
    await countdown();
    const baseline = await stored();
    const result: any = {mobile, structures: []};
    for (const [kind, target] of [
      ['crate', 3750],
      ['pillar', 5370],
    ] as const) {
      await advance(target);
      expect(await hp()).toBe('체력 3');
      expect(await effects()).toContain('방패');
      result.structures.push({kind, x: await x(), hp: await hp(), shield: true});
    }
    const session = mobile ? await c.newCDPSession(p) : null;
    let held: any = null;
    const point = async (type: string, id: number) => {
      const b = (await p.locator(`[data-control="${type}"]`).boundingBox())!;
      return {id, x: b.x + b.width / 2, y: b.y + b.height / 2};
    };
    const jump = async () => {
      if (!session) {
        await p.keyboard.press('Space');
        return;
      }
      const j = await point('jump', 22);
      await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: held ? [held, j] : [j]});
      await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held ? [held] : []});
    };
    const slide = async (down: boolean) => {
      if (!session) {
        if (down) await p.keyboard.down('ArrowDown');
        else await p.keyboard.up('ArrowDown');
        return;
      }
      held = down ? await point('slide', 11) : null;
      await session.send('Input.dispatchTouchEvent', {
        type: down ? 'touchStart' : 'touchEnd',
        touchPoints: held ? [held] : [],
      });
    };
    await advance(6300);
    await slide(true);
    await advance(6450);
    await slide(false);
    await jump();
    await p.clock.runFor(34);
    const under = await p.evaluate(() => (window as any).__structureQA.actor);
    expect(under.crouched).toBe(true);
    expect(under.feet).toBeCloseTo(440, 3);
    expect(await hp()).toBe('체력 3');
    expect(await effects()).toContain('방패');
    await p.screenshot({path: `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-ceiling.png`});
    await advance(6620);
    await p.clock.runFor(34);
    expect((await p.evaluate(() => (window as any).__structureQA.actor)).crouched).toBe(false);
    expect(await hp()).toBe('체력 3');
    result.ceilingReleaseAndBlockedJump = true;
    await advance(8300);
    expect(await effects()).toContain('방패');
    for (let i = 0; i < 150 && (await x()) > 8000; i++) await p.clock.runFor(34);
    expect(await x()).toBeLessThan(8000);
    expect(await hp()).toBe('체력 2');
    expect(await effects()).toContain('방패');
    const fallen = {
      x: await x(),
      score: await p.locator('#score').innerText(),
      stars: await p.locator('#stars').innerText(),
    };
    await advance(8300);
    expect(await p.locator('#score').innerText()).toBe(fallen.score);
    expect(await p.locator('#stars').innerText()).toBe(fallen.stars);
    expect(await hp()).toBe('체력 2');
    result.fallBypassesShieldAndNoDuplicateScore = fallen;
    await click('[data-action="pause"]');
    await click('[data-action="restart"]');
    await countdown();
    expect(await hp()).toBe('체력 3');
    expect(await effects()).toBe('');
    await advance(4100);
    await jump();
    await advance(5900);
    expect(await hp()).toBe('체력 3');
    expect(await effects()).not.toContain('방패');
    await advance(7600);
    expect(await hp()).toBe('체력 2');
    await advance(7900);
    expect(await hp()).toBe('체력 2');
    result.monsterShieldAndActualHpLoss = true;
    await p.screenshot({path: `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-monster.png`});
    await click('[data-action="pause"]');
    const frozen = await x();
    await p.clock.runFor(11000);
    expect(await x()).toBe(frozen);
    await click('[data-action="resume"]');
    await countdown();
    await click('[data-action="pause"]');
    await click('[data-action="islands"]');
    const after = await stored();
    for (const key of ['stages', 'courses', 'journal', 'expeditions']) expect(after[key]).toEqual(baseline[key]);
    result.unfinishedRecordsPreserved = true;
    // Restore a real supported v1 file through the normal preview/confirm UI.
    await click('[data-action="home"]');
    await click('[data-action="settings"]');
    await p.locator('#import-file').setInputFiles('artifacts/legacy-v1-save.json');
    await click('[data-action="import-confirm"]');
    await p.locator('[data-setting="music"]').uncheck();
    await p.locator('[data-setting="sfx"]').uncheck();
    await click('[data-action="home"]');
    await click('[data-action="islands"]');
    await click('[data-action="stage:cave"]');
    await click('[data-action="start"]');
    await countdown();
    await advance(3380);
    await jump();
    await advance(3900);
    expect(await hp()).toBe('체력 3');
    expect(await effects()).toContain('방패');
    let firstContact = 0;
    while ((await x()) < 4180 && (await effects()).includes('방패')) {
      await p.clock.runFor(17);
      firstContact = await x();
    }
    expect(firstContact).toBeGreaterThanOrEqual(4000 - 21);
    expect(await hp()).toBe('체력 3');
    expect(await effects()).not.toContain('방패');
    const messages = await p.evaluate(() => (window as any).__structureQA.messages as string[]);
    expect(messages.some(m => m.includes('! 낙석'))).toBe(true);
    result.fallingRockWarningAndContact = {firstContact};
    await p.screenshot({path: `artifacts/${prefix}-${mobile ? 'mobile' : 'desktop'}-falling.png`});
    await click('[data-action="pause"]');
    await click('[data-action="restart"]');
    await countdown();
    expect(await hp()).toBe('체력 3');
    expect(await effects()).toBe('');
    results.push(result);
    await c.close();
    console.log(prefix, mobile ? 'mobile' : 'desktop', 'passed');
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await writeFile(
    `artifacts/${prefix}-results.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        browser: await browser.version(),
        environment:
          'Linux Chromium PC 1280x800 DPR1 keyboard / mobile 844x390 DPR2 actual CDP touch, virtual game clock; no physical device; no player-state overrides',
        results,
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
