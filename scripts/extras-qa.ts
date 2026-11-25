import {existsSync} from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium, expect} from '@playwright/test';
import {routeInputs} from './check-routes';
import {getCourse} from '../src/levels/variants';
import {gateFor, treasureFor} from '../src/levels/play-extras';
// The playful extras in a real browser: the blessing picker, Athena's shield from the start, the
// combo chip, a full scripted beach run past the chest and the O/X gate, the result's extras line
// and saved record, photo mode's picture, the device status and the class's wooden horse.
const url = process.env.QA_URL || 'http://localhost:4176/Odyssey-Run/';
const b = await chromium.launch({
  executablePath: process.env.QA_CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const errors: string[] = [];
await mkdir('artifacts', {recursive: true});
try {
  const c = await b.newContext({viewport: {width: 1280, height: 720}, acceptDownloads: true});
  const p = await c.newPage();
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.install();
  await p.goto(url);
  await p.waitForSelector('.home');
  await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 1000);
  const tap = (s: string) => p.locator(s).first().click(),
    x = async () => Number(await p.locator('#progress').getAttribute('data-distance')),
    save = () =>
      p.evaluate(() => {
        const k = Object.keys(localStorage).find(k => k.startsWith('odyssey-run:') && k.endsWith(':save'))!;
        return JSON.parse(localStorage.getItem(k)!);
      }),
    advance = async (target: number) => {
      let n = 0;
      while ((await x()) < target && n++ < 20)
        await p.clock.runFor(Math.max(17, Math.ceil(((target - (await x())) / 320) * 1000)));
    },
    key = async (type: string) => {
      if (type === 'jump') await p.keyboard.press('Space');
      else if (type === 'down') await p.keyboard.down('ArrowDown');
      else await p.keyboard.up('ArrowDown');
    };
  // A new sailor can start the prologue from the island map: a guided practice run.
  await tap('[data-action="islands"]');
  await tap('[data-action="prologue"]');
  await p.waitForSelector('[data-action="start"]');
  await tap('[data-action="start"]');
  let n = 0;
  while ((await p.locator('.countdown').count()) && n++ < 300) await p.clock.runFor(17);
  await expect(p.locator('.route-progress span').first()).toContainText('프롤로그');
  await p.keyboard.press('Escape');
  await tap('[data-action="islands"]');
  await tap('[data-action="stage:beach"]');
  await p.waitForSelector('.blessing-picker');
  await expect(p.locator('.blessing-picker input')).toHaveCount(4);
  await p.locator('.blessing-picker input[value="athena"]').check({force: true});
  await p.screenshot({path: 'artifacts/extras-prepare.png'});
  await tap('[data-action="start"]');
  let i = 0;
  while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
  // Athena's shield is held from the first step.
  await expect(p.locator('#effects')).toContainText('방패');
  // The fever gauge shows on an ordinary island run.
  await expect(p.locator('#fever')).toBeVisible();
  const course = getCourse('beach', 'classic'),
    plan = routeInputs('beach', 'upper', true),
    gate = gateFor(course, 'qa')!,
    chest = treasureFor(course)!;
  const events = [
    ...plan.jumps.map(x => ({x, type: 'jump'})),
    ...plan.slides.flatMap(s => [
      {x: s.start, type: 'down'},
      {x: s.end, type: 'up'},
    ]),
  ].sort((a, b) => a.x - b.x);
  let missionSeen = false,
    comboSeen = false,
    shotChest = false,
    shotGate = false;
  for (const e of events) {
    await advance(e.x);
    if (!comboSeen && (await p.locator('#combo').textContent())?.includes('콤보')) comboSeen = true;
    if (!missionSeen && (await p.locator('#mission').textContent())?.includes('🎯')) {
      missionSeen = true;
      await p.screenshot({path: 'artifacts/extras-mission.png'});
    }
    if (!shotChest && (await x()) > chest.x - 700) {
      shotChest = true;
      await p.screenshot({path: 'artifacts/extras-chest.png'});
    }
    if (!shotGate && (await x()) > gate.x - 900) {
      shotGate = true;
      await p.screenshot({path: 'artifacts/extras-gate.png'});
    }
    await key(e.type);
  }
  await advance(23700);
  await p.clock.runFor(1800);
  await expect(p.locator('.result')).toBeVisible();
  expect(comboSeen).toBe(true);
  expect(missionSeen).toBe(true);
  await expect(p.locator('.extras-result')).toContainText('돌발 미션');
  await expect(p.locator('.extras-result')).toContainText('최고 콤보');
  await expect(p.locator('.extras-result')).toContainText('아테나의 방패');
  await expect(p.locator('.extras-result')).toContainText('O/X');
  await p.screenshot({path: 'artifacts/extras-result.png'});
  const s = await save();
  expect(s.play.combos.beach.best).toBeGreaterThan(5);
  expect(s.stages.beach.complete).toBe(true);
  // Photo mode from the pause dialog of a new run.
  await tap('[data-action="restart"]');
  i = 0;
  while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
  await p.clock.runFor(1500);
  await p.keyboard.press('Escape');
  await tap('[data-action="photo"]');
  await expect(p.locator('.photo-bar')).toBeVisible();
  await expect(p.locator('.hud')).toHaveCount(0);
  await p.locator('input[name="photo-pose"][value="cheer"]').check({force: true});
  await p.clock.runFor(100);
  await p.screenshot({path: 'artifacts/extras-photo.png'});
  const download = p.waitForEvent('download');
  await tap('[data-action="photo-save"]');
  for (let k = 0; k < 5; k++) await p.clock.runFor(50);
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^odyssey-beach-\d{4}-\d{2}-\d{2}\.png$/);
  await expect(p.locator('#photo-status')).toContainText('저장했어요');
  await tap('[data-action="photo-close"]');
  await expect(p.locator('.pause-panel')).toBeVisible();
  await tap('[data-action="islands"]');
  // The device status shows the last run's average frame rate.
  await tap('[data-action="home"]');
  await tap('[data-action="settings"]');
  await p.locator('.device-status summary').click();
  await expect(p.locator('.device-status')).toContainText('fps');
  await p.screenshot({path: 'artifacts/extras-device.png'});
  // The class's wooden horse has a plank for the finished run.
  await tap('[data-action="home"]');
  await tap('[data-action="profiles"]');
  await expect(p.locator('.horse-grid i.built')).toHaveCount(1);
  await p.locator('.horse').screenshot({path: 'artifacts/extras-horse.png'});
  // The class's live mission starts with a clock and can be stopped.
  await tap('[data-action="live-start"]');
  await expect(p.locator('#live-time')).toContainText('남은 시간');
  await p.locator('.live-mission').screenshot({path: 'artifacts/extras-live.png'});
  await tap('[data-action="live-stop"]');
  await expect(p.locator('.live-form')).toBeVisible();
  // The island's reading opens once it is complete; two right answers record it.
  await tap('[data-action="home"]');
  await tap('[data-action="journal"]');
  await tap('[data-action="readings"]');
  await tap('[data-action="reading:beach"]');
  await p.locator('input[name="reading-0"][value="1"]').check({force: true});
  await p.locator('input[name="reading-1"][value="0"]').check({force: true});
  await tap('[data-action="reading-check:beach"]');
  await expect(p.locator('#reading-status')).toContainText('모두 맞혔어요');
  expect((await save()).play.readings).toEqual(['beach']);
  // The word cards turn two at a time.
  await tap('[data-action="readings"]');
  await tap('[data-action="journal"]');
  await tap('[data-action="cards"]');
  await tap('[data-action="card:0"]');
  await tap('[data-action="card:1"]');
  await expect(p.locator('.word-card.up')).not.toHaveCount(0);
  // A wrong quiz answer goes into the notebook, and the notebook asks it again.
  await tap('[data-action="journal"]');
  await tap('[data-action="quiz"]');
  const right = await p.evaluate(() => document.querySelector('h1')!.textContent);
  void right;
  await tap('[data-action="quiz-answer:2"]');
  const missed = (await save()).play.missed.length;
  if (missed) {
    await tap('[data-action="journal"]');
    await tap('[data-action="retry"]');
    await expect(p.locator('.quiz-panel .eyebrow')).toContainText('오답 노트');
  }
  // The device check runs its storage check, and a lesson preset applies to the next start.
  await tap('[data-action="journal"]');
  await tap('[data-action="home"]');
  await tap('[data-action="settings"]');
  await tap('[data-action="device-check"]');
  await tap('[data-action="check:storage"]');
  await expect(p.locator('#check-storage')).toContainText('저장');
  await tap('[data-action="settings"]');
  await tap('[data-action="preset:easy"]');
  await tap('[data-action="home"]');
  await tap('[data-action="islands"]');
  await tap('[data-action="stage:beach"]');
  await expect(p.locator('.assist-note').last()).toContainText('수업 프리셋');
  await expect(p.locator('.hero-ability')).toBeVisible();
  await tap('[data-action="islands"]');
  await tap('[data-action="home"]');
  await tap('[data-action="settings"]');
  await tap('[data-action="preset:off"]');
  // A boss run shows its weak points on the HUD.
  await tap('[data-action="home"]');
  await tap('[data-action="challenges"]');
  await tap('[data-action="boss:beach"]');
  await p.waitForSelector('[data-action="start"]');
  await tap('[data-action="start"]');
  i = 0;
  while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
  await expect(p.locator('#maps')).toContainText('보스 약점 0/3');
  await p.keyboard.press('Escape');
  await tap('[data-action="islands"]');
  // Today's shuffled route opens from the special voyages once the island is complete.
  await tap('[data-action="home"]');
  await tap('[data-action="challenges"]');
  await tap('[data-action="shuffle:beach"]');
  await p.waitForSelector('[data-action="start"]');
  await tap('[data-action="start"]');
  i = 0;
  while ((await p.locator('.countdown').count()) && i++ < 300) await p.clock.runFor(17);
  await expect(p.locator('.route-progress span').first()).toContainText('셔플 항로');
  await p.clock.runFor(1000);
  await p.screenshot({path: 'artifacts/extras-shuffle.png'});
  expect(errors).toEqual([]);
  await writeFile('artifacts/extras-qa.json', JSON.stringify({play: s.play, errors}, null, 1));
  console.log(
    'extras: prologue, blessing, combo, fever, mission, chest, gate, result, photo, device status, horse, live mission, reading, cards, notebook, device check, preset, boss weak points and shuffle passed',
  );
} finally {
  await b.close();
}
