import {chromium, type BrowserContext, type Page} from '@playwright/test';
import {existsSync, readFileSync} from 'node:fs';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import qrcode from 'qrcode-generator';
import {linkUrl, type ContestResult} from '../src/systems/share';
// Classroom features end to end: two tabs of one sailor, whole-class backup and restore, the
// backup reminder, and the contest board's camera scan, suspicious-result flag, removal and CSV.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/',
  base = new URL(url).pathname,
  SAVE = `odyssey-run:${base}:save`,
  dir = await mkdtemp(join(tmpdir(), 'odyssey-classroom-')),
  executablePath = process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  errors: string[] = [],
  results: Record<string, unknown> = {};
function check(ok: unknown, message: string) {
  if (!ok) throw Error(message);
}
const watch = (p: Page, label: string) => p.on('pageerror', e => errors.push(`${label}: ${e.message}`));
async function open(c: BrowserContext, label: string) {
  const p = await c.newPage();
  watch(p, label);
  await p.goto(url);
  await p.waitForSelector('.home');
  return p;
}
const visible = (p: Page, action: string) => p.locator(`[data-action="${action}"]:visible`).first();
const legacy = 'artifacts/legacy-v1-save.json';

// A real beach result: distance 2400 + 80 starlight + 2 maps + finish bonus, 75 s at 320 px/s.
const real: ContestResult = {
  kind: 'result',
  contest: 'qa0001',
  name: '하린',
  score: 2400 + 800 + 200 + 500,
  complete: true,
  stars: 80,
  maps: 2,
  hpLoss: 0,
  time: 77.5,
};
const forged: ContestResult = {...real, name: '도윤', score: 4200, time: 30};
// A still Y4M clip of the result QR, fed to Chromium as its fake camera.
function y4m(text: string) {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount(),
    W = 640,
    H = 480,
    cell = Math.floor(400 / (n + 8)),
    size = cell * (n + 8),
    ox = (W - size) >> 1,
    oy = (H - size) >> 1,
    y = Buffer.alloc(W * H, 235);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c))
        for (let dy = 0; dy < cell; dy++)
          for (let dx = 0; dx < cell; dx++) y[(oy + (r + 4) * cell + dy) * W + ox + (c + 4) * cell + dx] = 16;
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128),
    parts = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)];
  for (let i = 0; i < 10; i++) parts.push(Buffer.from('FRAME\n'), y, uv);
  return Buffer.concat(parts);
}

const b = await chromium.launch({executablePath, args: ['--no-sandbox']});
try {
  // 1. Two tabs of one sailor: tab B restores a save, tab A changes a setting afterwards.
  const ctx = await b.newContext({serviceWorkers: 'block', acceptDownloads: true});
  const A = await open(ctx, 'tab A'),
    B = await open(ctx, 'tab B');
  await visible(B, 'settings').click();
  await B.locator('#import-file').setInputFiles(legacy);
  await B.locator('[data-action="import-confirm"]').click();
  await A.bringToFront();
  await A.waitForFunction(() => /다른 탭/.test(document.querySelector('#notice')?.textContent ?? ''));
  await visible(A, 'settings').click();
  await A.locator('[data-setting="sfx"]').click({force: true});
  const merged = await A.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE);
  check(merged.stages.beach.complete, 'tab A overwrote the save restored in tab B');
  check(merged.settings.sfx === false, 'tab A lost its own setting change');
  results.tabs = {beachComplete: merged.stages.beach.complete, sfx: merged.settings.sfx};

  // 2. Whole-class backup: add a second sailor, export, restore into an empty browser.
  await visible(A, 'profiles').click();
  await A.fill('#profile-name', '민준');
  await A.locator('[data-action="profile-add"]').click();
  await A.goto(url);
  await A.waitForSelector('.home');
  await visible(A, 'settings').click();
  const [download] = await Promise.all([A.waitForEvent('download'), A.locator('[data-action="class-export"]').click()]);
  const file = join(dir, 'class.json');
  await download.saveAs(file);
  const line = await A.locator('#protection').textContent();
  check(/마지막 반 전체 백업: 오늘/.test(line ?? ''), `backup age not shown after export: ${line}`);
  const fresh = await b.newContext({serviceWorkers: 'block'});
  const C = await open(fresh, 'restore');
  await visible(C, 'settings').click();
  await C.locator('#class-import').setInputFiles(file);
  await C.waitForSelector('[data-action="class-import-confirm"]');
  const preview = await C.locator('.panel').textContent();
  check(/항해사 2명/.test(preview ?? ''), `class preview: ${preview}`);
  await C.locator('[data-action="class-import-confirm"]').click();
  await C.waitForSelector('.settings');
  const notice = await C.locator('#notice').textContent();
  check(/새 항해사 1명/.test(notice ?? ''), `restore summary: ${notice}`);
  const sailors = await C.evaluate(k => JSON.parse(localStorage.getItem(k + ':profiles')!).list.length, SAVE);
  check(sailors === 2, `restored sailors ${sailors}`);
  results.backup = {file: download.suggestedFilename(), notice, sailors};

  // 3. The reminder appears on a class device whose last backup is three weeks old.
  const old = await b.newContext({serviceWorkers: 'block'});
  await old.addInitScript(
    ([k, at]) => {
      if (localStorage.getItem(k + ':class-backup-at')) return;
      localStorage.setItem(k + ':class-backup-at', at);
      localStorage.setItem(
        k + ':contests',
        JSON.stringify({
          hosted: [{id: 'old001', title: '지난 대회', stage: 'beach', variant: 'classic', assist: false, entries: []}],
          best: {},
        }),
      );
    },
    [SAVE, String(Date.now() - 21 * 86_400_000)],
  );
  const D = await open(old, 'reminder');
  const reminder = await D.locator('#notice').textContent();
  check(/21일이 지났어요/.test(reminder ?? ''), `backup reminder: ${reminder}`);
  results.reminder = reminder;
  await Promise.all([ctx.close(), fresh.close(), old.close()]);
} finally {
  await b.close();
}

// 4. Contest board with a fake camera showing a real student's result QR.
const clip = join(dir, 'result.y4m');
await writeFile(clip, y4m(linkUrl(real, url)));
const cam = await chromium.launch({
  executablePath,
  args: [
    '--no-sandbox',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${clip}`,
  ],
});
try {
  const ctx = await cam.newContext({serviceWorkers: 'block', permissions: ['camera'], acceptDownloads: true});
  await ctx.addInitScript(k => {
    if (!localStorage.getItem(k))
      localStorage.setItem(
        k,
        JSON.stringify({
          hosted: [{id: 'qa0001', title: '스캔 대회', stage: 'beach', variant: 'classic', assist: false, entries: []}],
          best: {},
        }),
      );
  }, SAVE + ':contests');
  const p = await open(ctx, 'board');
  await visible(p, 'challenges').click();
  await p.locator('[data-action="contests"]').click();
  await p.locator('[data-action="contest-open:qa0001"]').click();
  await p.waitForSelector('.contest-board');
  await p.locator('[data-action="contest-scan:qa0001"]').click();
  await p.waitForFunction(() => document.querySelectorAll('#board-list li').length > 0, null, {timeout: 20000});
  await p.waitForTimeout(1500);
  check((await p.locator('#board-list li').count()) === 1, 'the same QR was added more than once');
  check((await p.locator('#board-list li.doubt').count()) === 0, 'a real result was flagged');
  await p.locator('[data-action="contest-scan:qa0001"]').click();
  check(
    await p.evaluate(() => !(document.querySelector('.scanner video') as HTMLVideoElement).srcObject),
    'camera still attached after stopping',
  );
  // A hand-made code: 4,200 points in 30 seconds cannot come from a run.
  await p.fill('#contest-code', linkUrl(forged, url));
  await p.locator('[data-action="contest-paste"]').click();
  await p.waitForSelector('#board-list li.doubt');
  const [csvFile] = await Promise.all([
    p.waitForEvent('download'),
    p.locator('[data-action="contest-csv:qa0001"]').click(),
  ]);
  const csvPath = join(dir, 'board.csv');
  await csvFile.saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  check(csv.startsWith('﻿등수,이름,점수'), 'CSV header');
  check(/도윤,4200,O,80,2,0,30,.+/.test(csv), 'CSV does not mark the forged row');
  check(/하린,3900,O,80,2,0,77.5,\r\n/.test(csv), 'CSV row for the scanned result');
  await p.locator(`[data-action="contest-drop:qa0001/${encodeURIComponent('도윤')}"]`).click();
  await p.waitForFunction(() => document.querySelectorAll('#board-list li').length === 1);
  results.board = {csv: csv.split('\r\n').slice(0, 3)};
  await ctx.close();
} finally {
  await cam.close();
}
// 5. Hostile share links: markup in names and titles shows as text, a broken code is refused
// with a message, and the built page's security policy is never violated.
const hostile = await chromium.launch({executablePath, args: ['--no-sandbox']});
try {
  const ctx = await hostile.newContext({serviceWorkers: 'block'});
  await ctx.addInitScript(() => {
    const w = window as unknown as {__csp: string[]};
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', e => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  const p = await ctx.newPage();
  watch(p, 'hostile');
  const dialogs: string[] = [];
  p.on('dialog', d => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const name = '<b>x</b>"\'&',
    title = '<i>대회</i>';
  await p.goto(
    linkUrl(
      {kind: 'result', contest: 'hx0001', name, score: 100, complete: false, stars: 0, maps: 0, hpLoss: 0, time: 40},
      url,
    ),
  );
  await p.waitForSelector('.contest-board');
  check((await p.locator('#board-list b').first().textContent()) === name, 'name not shown as plain text');
  check((await p.locator('#board-list b b, #board-list i').count()) === 0, 'markup in a name became elements');
  await p.goto(linkUrl({kind: 'contest', id: 'hx0002', title, stage: 'beach', variant: 'classic', assist: false}, url));
  await p.waitForSelector('.contest-panel');
  check((await p.locator('.contest-panel h1').textContent()) === title, 'title not shown as plain text');
  check((await p.locator('.contest-panel h1 i').count()) === 0, 'markup in a title became elements');
  await p.goto(url + '#r=AAAA.zz');
  await p.waitForSelector('#notice:not(:empty), .home');
  await p.goto(url);
  await p.waitForSelector('.home');
  for (const s of ['islands', 'home', 'settings', 'home', 'profiles', 'progress']) {
    await visible(p, s).click();
    await p.waitForTimeout(200);
  }
  const csp = await p.evaluate(() => (window as unknown as {__csp: string[]}).__csp);
  check(!dialogs.length, `a dialog opened: ${dialogs.join(' | ')}`);
  check(!csp.length, `security policy violations: ${csp.join(' | ')}`);
  results.hostile = {name, title, csp: csp.length};
  await ctx.close();
} finally {
  await hostile.close();
}
check(!errors.length, `page errors: ${errors.join(' | ')}`);
console.log(JSON.stringify(results, null, 1));
console.log('classroom: tabs, backup, reminder, scan, flag, drop, CSV and hostile links passed');
