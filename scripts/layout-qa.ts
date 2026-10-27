import {chromium, type Page} from '@playwright/test';
import {existsSync} from 'node:fs';
// Finds text that is cut off by a clipping box or drawn over other text, on every menu screen,
// at the viewport sizes classrooms use, in Korean and English, with an empty and a played save.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  base = new URL(url).pathname,
  SAVE = `odyssey-run:${base}:save`,
  only = process.env.QA_SCREENS?.split(','),
  legacy = 'artifacts/legacy-v1-save.json';
const VIEWPORTS = [
  {name: 'desktop-1920', width: 1920, height: 1080},
  {name: 'desktop-1440', width: 1440, height: 900},
  {name: 'laptop-1366', width: 1366, height: 768},
  {name: 'laptop-1280', width: 1280, height: 720},
  // Typical Windows browser windows: 1920×1080 at 125% scaling, and 1366×768 minus toolbars.
  {name: 'windows-1536', width: 1536, height: 730},
  {name: 'windows-1366', width: 1366, height: 650},
  {name: 'short-1280', width: 1280, height: 600},
  {name: 'chromebook-1024', width: 1024, height: 768},
  {name: 'tablet-1180', width: 1180, height: 820, touch: true},
  {name: 'phone-844', width: 844, height: 390, touch: true},
  {name: 'phone-740', width: 740, height: 360, touch: true},
  {name: 'phone-667', width: 667, height: 375, touch: true},
  // Landscape phones with the browser's address and tool bars showing.
  {name: 'phone-bars-658', width: 658, height: 320, touch: true},
  {name: 'phone-bars-740', width: 740, height: 300, touch: true},
  {name: 'phone-portrait-390', width: 390, height: 664, touch: true},
];
// Screens reached by a button on the home page (or a page reached from there).
const SCREENS: [string, string[]][] = [
  ['home', []],
  ['islands', ['islands']],
  ['prepare', ['islands', 'stage:beach']],
  ['challenges', ['challenges']],
  ['contests', ['challenges', 'contests']],
  ['wardrobe', ['wardrobe']],
  ['harbor', ['harbor']],
  ['journal', ['journal']],
  ['codex', ['codex']],
  ['people', ['codex', 'people']],
  ['relics', ['codex', 'relics']],
  ['bestiary', ['codex', 'bestiary']],
  ['landscapes', ['codex', 'landscapes']],
  ['quiz', ['journal', 'quiz']],
  ['profiles', ['profiles']],
  ['settings', ['settings']],
  ['offline', ['settings', 'offline']],
];
// Plain source: tsx would wrap named functions with a helper the page does not have.
const SCAN = `(() => {
  const problems = [], boxes = [];
  const shown = el => el.checkVisibility ? el.checkVisibility({opacityProperty: true, visibilityProperty: true}) : true;
  const label = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\\s+/).join('.');
    const a = el.closest('[data-action]');
    return a ? s + ' [' + a.getAttribute('data-action') + ']' : s;
  };
  const walker = document.createTreeWalker(document.querySelector('#app'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = (n.nodeValue || '').trim(), el = n.parentElement;
    if (!text || !el || !shown(el) || el.closest('[hidden], [aria-hidden="true"], .sr-only, #rotate')) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
    for (const r of rects) {
      // Clipped: part of the glyph box lies outside an ancestor that hides overflow.
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible' && cs.clipPath === 'none') continue;
        // Scroll containers are fine: the text is reachable by scrolling.
        if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (a.scrollHeight > a.clientHeight + 1 || a.scrollWidth > a.clientWidth + 1)) break;
        const b = a.getBoundingClientRect(), t = 2;
        if (r.left < b.left - t || r.right > b.right + t || r.top < b.top - t || r.bottom > b.bottom + t) {
          problems.push({kind: 'clipped', text: text.slice(0, 40), by: label(a), at: label(el)});
          break;
        }
      }
      boxes.push({text: text.slice(0, 40), at: label(el), el, r});
    }
    // Ellipsis or line clamping hides the rest of the text.
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).textOverflow === 'ellipsis')
      problems.push({kind: 'ellipsis', text: text.slice(0, 40), at: label(el)});
  }
  // Overlap: glyph boxes of two different text runs cover each other.
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i], B = boxes[j];
      if (A.el === B.el) continue;
      const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left),
        h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      // Glyph boxes include the font's line gap, so require a real share of the shorter line.
      if (w > 3 && h > Math.max(3, 0.25 * Math.min(A.r.height, B.r.height))) problems.push({kind: 'overlap', text: A.text + ' ⟷ ' + B.text, at: A.at + ' ⟷ ' + B.at});
    }
  return problems;
})()`;
async function go(p: Page, steps: string[]) {
  await p.goto(url);
  await p.waitForSelector('.home', {timeout: 30000});
  for (const s of steps) {
    await p.locator(`[data-action="${s}"]:visible`).first().click();
    await p.waitForTimeout(150);
  }
  await p.waitForTimeout(250);
}
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const found = new Map<string, Set<string>>(),
  errors: string[] = [];
try {
  for (const lang of (process.env.QA_LANGS || 'ko,en').split(','))
    for (const played of (process.env.QA_SAVES || 'empty,played').split(',').map(v => v === 'played'))
      for (const v of VIEWPORTS) {
        const ctx = await b.newContext({
          viewport: {width: v.width, height: v.height},
          hasTouch: !!v.touch,
          isMobile: !!v.touch,
          deviceScaleFactor: v.touch ? 2 : 1,
          serviceWorkers: 'block',
        });
        await ctx.addInitScript(
          ([lang, key, save]) => {
            localStorage.setItem('odyssey-run:lang', lang);
            if (save && !localStorage.getItem(key)) localStorage.setItem(key, save);
          },
          [lang, SAVE, played ? (await import('node:fs')).readFileSync(legacy, 'utf8') : ''],
        );
        const p = await ctx.newPage();
        p.on('pageerror', e => errors.push(`${lang} ${v.name}: ${e.message}`));
        for (const [screen, steps] of SCREENS) {
          if (only && !only.includes(screen)) continue;
          try {
            await go(p, steps);
          } catch (e) {
            errors.push(`${lang} ${v.name} ${screen}: could not open (${(e as Error).message.split('\n')[0]})`);
            continue;
          }
          for (const q of (await p.evaluate(SCAN)) as {kind: string; text: string; at: string; by?: string}[]) {
            const key = `${q.kind} | ${screen} | ${q.text} | ${q.at}${q.by ? ' | by ' + q.by : ''}`;
            if (!found.has(key)) found.set(key, new Set());
            found.get(key)!.add(`${lang}${played ? '+save' : ''} ${v.name}`);
          }
        }
        await ctx.close();
      }
} finally {
  await b.close();
}
for (const [key, where] of found) console.log(`${key}\n    ${[...where].join(', ')}`);
for (const e of errors) console.log('ERROR ' + e);
console.log(`layout: ${found.size} text problems, ${errors.length} errors`);
if (found.size || errors.length) process.exit(1);
