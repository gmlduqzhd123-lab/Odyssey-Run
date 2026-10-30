import {chromium, expect, type Page} from '@playwright/test';
import {existsSync} from 'node:fs';
// Accessibility paths end to end: a gamepad (faked through navigator.getGamepads) moves through
// the menus, starts a run and pauses it; the device's reduced-motion, more-contrast and larger
// text settings reach the page.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  errors: string[] = [],
  results: Record<string, unknown> = {};
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
// Standard gamepad buttons: 0 A, 1 B, 9 Start, 12 up, 13 down.
async function press(p: Page, button: number) {
  await p.evaluate(i => ((window as any).__pad.buttons[i].pressed = true), button);
  await p.waitForTimeout(120);
  await p.evaluate(i => ((window as any).__pad.buttons[i].pressed = false), button);
  await p.waitForTimeout(120);
}
// Moves focus with the d-pad until the button for `action` has it, then presses A.
async function choose(p: Page, action: string) {
  for (let i = 0; i < 80; i++) {
    if ((await p.evaluate(() => document.activeElement?.getAttribute('data-action'))) === action) {
      await press(p, 0);
      return;
    }
    await press(p, 13);
  }
  throw Error(`gamepad could not reach ${action}`);
}
try {
  const c = await b.newContext({viewport: {width: 1280, height: 720}, serviceWorkers: 'block'});
  // Plain source: tsx would wrap functions with a helper the page does not have.
  await c.addInitScript(`(() => {
    const pad = {id: 'QA pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
      buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))};
    window.__pad = pad;
    Object.defineProperty(navigator, 'getGamepads', {value: () => [pad, null, null, null]});
    addEventListener('load', () => setTimeout(() => dispatchEvent(new Event('gamepadconnected')), 300));
  })()`);
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.waitForTimeout(600);
  await choose(p, 'islands');
  await p.waitForSelector('.island-card');
  await choose(p, 'stage:beach');
  await p.waitForSelector('[data-action="start"]');
  // With a pad connected the guide shows the pad's buttons.
  await expect(p.locator('.control-guide')).toContainText('Ⓐ');
  await choose(p, 'start');
  await p.waitForSelector('.countdown', {state: 'detached', timeout: 15000});
  await press(p, 0);
  await press(p, 9);
  await expect(p.locator('[data-action="resume"]')).toBeVisible();
  results.gamepad = 'menus → islands → beach → start → jump → Start pauses';
  // With the run paused, the d-pad and A work the pause menu again.
  await choose(p, 'resume');
  await p.waitForSelector('.countdown, .play-ui', {timeout: 10000});
  results.resume = true;
  await c.close();

  const d = await b.newContext({
    viewport: {width: 1280, height: 720},
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    contrast: 'more',
  });
  const q = await d.newPage();
  // The browser's own default font size setting, as a person would raise it.
  await (await d.newCDPSession(q)).send('Page.setFontSizes', {fontSizes: {standard: 20}});
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(url);
  await q.waitForSelector('.home');
  const app = await q.evaluate(() => {
    const el = document.querySelector('#app') as HTMLElement;
    return {
      contrast: el.hasAttribute('data-contrast'),
      large: el.hasAttribute('data-large-text'),
      scale: el.style.getPropertyValue('--text-scale'),
    };
  });
  if (!app.contrast || !app.large || app.scale !== '1.25') throw Error(`device settings: ${JSON.stringify(app)}`);
  await q.locator('[data-action="settings"]:visible').first().click();
  await expect(q.locator('.device-note')).toBeVisible();
  results.device = app;
  await d.close();

  // A picture that cannot load becomes a parchment tile with one notice, never a broken image.
  const e = await b.newContext({viewport: {width: 1280, height: 720}, serviceWorkers: 'block'});
  await e.route(/assets\/art\/(penelope|athena)-/, route => route.abort());
  const r = await e.newPage();
  r.on('pageerror', err => errors.push(err.message));
  await r.goto(url);
  await r.waitForSelector('.home');
  await r.locator('[data-action="codex"]:visible').first().click();
  await r.locator('[data-action="people"]').click();
  await r.waitForFunction(() => document.querySelectorAll('img.art-missing').length >= 2, null, {timeout: 15000});
  const broken = await r.evaluate(
    () => [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).length,
  );
  if (broken) throw Error(`${broken} broken images left`);
  await expect(r.locator('#notice')).toContainText('그림 일부를 불러오지 못했어요');
  results.missingArt = 'placeholder + notice';
  await e.close();
} finally {
  await b.close();
}
if (errors.length) throw Error(`page errors: ${errors.join(' | ')}`);
console.log(JSON.stringify(results, null, 1));
console.log('access: gamepad menus/run/pause, reduced motion, more contrast, larger text and missing pictures passed');
