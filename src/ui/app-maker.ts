import {koreanDay} from '../levels/daily';
import {linkUrl, parseLinkText, type CourseLink} from '../systems/share';
import {newContestId} from '../storage/contests';
import {button, esc} from './html';
import {COURSES, STAGES, type StageId} from '../levels/courses';
import {unlocked} from '../storage/save';
import {PROLOGUE_TITLE} from '../levels/prologue';
import {recordRun} from '../storage/feats';
import type {MakerDraft} from './maker-view';
import {loadContactMasks} from '../systems/contact';
import {MAKER_SLOTS, buildCustom, checkCustom, isBlocks, randomBlocks, BLOCKS, type BlockId} from '../levels/maker';
import type {App} from './app';
import {pageViews, makerView, MAKER_KEY} from './app-shared';
// Student courses: the course maker, a course received by QR, the class gallery and a custom course's result. Methods of App (see ui/app).
export const makerMethods = {
  // Student-built courses: drafts stay on this device; a passing course can be run and shared.
  loadDraft(this: App): MakerDraft {
    if (this.draft) return this.draft;
    try {
      const d = JSON.parse(this.storage?.getItem(MAKER_KEY) ?? 'null');
      if (d && STAGES.includes(d.stage) && typeof d.blocks === 'string' && isBlocks(d.blocks))
        return (this.draft = {stage: d.stage, blocks: d.blocks, title: String(d.title ?? '').slice(0, 12)});
    } catch {}
    return (this.draft = {stage: 'beach', blocks: 'f'.repeat(MAKER_SLOTS), title: ''});
  },
  // Reads the form back into the draft (the selects are the source while the page is open).
  readDraft(this: App) {
    const d = this.loadDraft();
    if (this.screen !== 'maker') return d;
    const stage = this.ui.querySelector<HTMLSelectElement>('#maker-stage')?.value as StageId,
      blocks = [...this.ui.querySelectorAll<HTMLSelectElement>('[data-slot]')].map(s => s.value).join('');
    if (STAGES.includes(stage) && unlocked(this.store.data, stage)) d.stage = stage;
    if (isBlocks(blocks)) d.blocks = blocks;
    d.title = (this.ui.querySelector<HTMLInputElement>('#maker-title')?.value ?? '').trim().slice(0, 12);
    try {
      this.storage?.setItem(MAKER_KEY, JSON.stringify(d));
    } catch {}
    return d;
  },
  maker(this: App, message = '') {
    this.abandon();
    this.world.showHome();
    const d = this.loadDraft();
    if (!unlocked(this.store.data, d.stage)) d.stage = 'beach';
    // Checking a course runs it, which needs the contact outlines.
    void this.later(
      () => loadContactMasks().then(makerView),
      m =>
        this.set(
          m.makerMarkup(this.header('코스 만들기', 'challenges'), d, id => unlocked(this.store.data, id), message),
          'maker',
        ),
    );
  },
  makerCheck(this: App) {
    const d = this.readDraft(),
      r = checkCustom(buildCustom(d.stage, d.blocks, d.title || '나만의 코스'));
    return {
      ok: r.ok,
      text: r.ok
        ? `✓ 끝까지 갈 수 있는 코스예요! 별빛 ${r.stars}개를 모았어요.`
        : `${r.slot + 1}번 칸(${BLOCKS[d.blocks[r.slot] as BlockId].name})에서 막혀요. 블록을 바꿔 보세요.`,
    };
  },
  makerAction(this: App, kind: string) {
    const say = (text: string) => this.setText('#maker-message', text);
    if (kind === 'random' || kind === 'clear') {
      const d = this.readDraft();
      d.blocks = kind === 'random' ? randomBlocks(Math.random, d.stage) : 'f'.repeat(MAKER_SLOTS);
      // Saved now: the page is re-drawn once the maker's code has loaded.
      try {
        this.storage?.setItem(MAKER_KEY, JSON.stringify(d));
      } catch {}
      this.maker(
        kind === 'random' ? '무작위 코스를 만들었어요. 마음에 드는 칸만 바꿔도 돼요.' : '모든 칸을 평지로 바꿨어요.',
      );
    } else if (kind === 'check') say(this.makerCheck().text);
    else if (kind === 'share') {
      const c = this.makerCheck();
      if (!c.ok) return say(c.text);
      const d = this.readDraft(),
        link: CourseLink = {kind: 'course', stage: d.stage, blocks: d.blocks, title: d.title || '나만의 코스'};
      void this.later(makerView, m => this.set(m.makerShareMarkup(d, linkUrl(link, location.href)), 'maker-share'));
    } else if (kind === 'run') void this.makerRun();
  },
  async makerRun(this: App) {
    const fromMaker = this.screen === 'maker';
    if (fromMaker) {
      const c = this.makerCheck();
      if (!c.ok) return this.setText('#maker-message', c.text);
    }
    const d = this.readDraft();
    if (!unlocked(this.store.data, d.stage)) return;
    await this.prepare(d.stage);
    if (this.screen !== 'prepare' || this.selected !== d.stage) return;
    this.special = 'custom';
    this.custom = buildCustom(d.stage, d.blocks, d.title || '나만의 코스');
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">BUILD YOUR OWN VOYAGE</span><h1 tabindex="-1">${esc(this.custom.name)}</h1><p>${COURSES[d.stage].name} · ${MAKER_SLOTS}칸 · 약 40초</p><p class="muted">나만의 코스는 기록·지도·해금에 반영하지 않아요.</p>${button('start', '출발 →', 'primary large')}${button('maker', '코스 만들기로', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  makerReceived(this: App, link: CourseLink) {
    this.abandon();
    this.world.showHome();
    this.draft = {stage: link.stage, blocks: link.blocks, title: link.title};
    const draft = this.draft;
    void this.later(makerView, m =>
      this.set(m.makerReceivedMarkup(draft, unlocked(this.store.data, link.stage)), 'maker-received'),
    );
  },
  galleryPage(this: App, message = '') {
    this.abandon();
    this.world.showHome();
    void this.later(pageViews, ([, , g]) =>
      this.set(g.galleryMarkup(this.header('반 코스 갤러리', 'contests'), this.gallery.ranked(), message), 'gallery'),
    );
  },
  galleryAction(this: App, kind: string, arg = '') {
    const i = Number(arg);
    if (kind === 'add') {
      // A course received by link, or the course on this device's maker.
      const d = this.screen === 'maker-received' || this.screen === 'maker' ? this.readDraft() : null;
      if (!d) return;
      const ok = this.gallery.add({stage: d.stage, blocks: d.blocks, title: d.title || '나만의 코스'});
      this.galleryPage(
        ok
          ? `‘${d.title || '나만의 코스'}’ 코스를 갤러리에 담았어요.`
          : '갤러리가 가득 찼어요. 코스를 몇 개 지워 주세요.',
      );
    } else if (kind === 'paste') {
      try {
        const link = parseLinkText(this.ui.querySelector<HTMLInputElement>('#gallery-code')?.value ?? '');
        if (link?.kind !== 'course') throw Error('학생 코스 화면의 링크를 붙여 넣어 주세요.');
        const ok = this.gallery.add(link);
        this.galleryPage(ok ? `‘${link.title}’ 코스를 담았어요.` : '갤러리가 가득 찼어요. 코스를 몇 개 지워 주세요.');
      } catch (error) {
        this.setText('#gallery-message', (error as Error).message);
      }
    } else if (kind === 'up' || kind === 'down') {
      this.gallery.vote(i, kind === 'up' ? 1 : -1);
      this.galleryPage();
    } else if (kind === 'remove') {
      this.gallery.remove(i);
      this.galleryPage('코스를 지웠어요.');
    } else if (kind === 'run') {
      const c = this.gallery.list[i];
      if (!c) return;
      this.draft = {stage: c.stage, blocks: c.blocks, title: c.title};
      const draft = this.draft;
      void this.later(makerView, m =>
        this.set(m.makerReceivedMarkup(draft, unlocked(this.store.data, c.stage)), 'maker-received'),
      );
    } else if (kind === 'contest') {
      const c = this.gallery.list[i];
      if (!c) return;
      const hosted = this.contests.host({
        id: newContestId(),
        title: c.title.slice(0, 12),
        stage: c.stage,
        variant: 'classic',
        assist: false,
        blocks: c.blocks,
      });
      this.contestBoard(hosted.id, '학생 코스로 대회를 만들었어요. 참가 QR을 띄워 주세요.');
    }
  },
  finishCustom(this: App) {
    const r = this.result!;
    this.sound.setPlaying(false);
    this.controls.clear();
    if (this.prologue) {
      this.store.data = recordRun(this.store.data, r, koreanDay(), {special: true, weather: false});
      if (r.complete) this.store.data.play.prologue = true;
      this.store.persist();
      this.set(
        `<div class="veil"><section class="panel result special-result"><span class="eyebrow">PROLOGUE</span><h1 tabindex="-1">${r.complete ? '연습 항해 완주! 준비 끝이에요' : '괜찮아요, 한 번 더 연습해요'}</h1><p>${PROLOGUE_TITLE}</p><p>별빛 ${r.stars} · 몬스터 밟기 ${this.run?.stomps ?? 0} · HP 손실 ${r.hpLoss}회</p>${this.damageSummary()}<div class="button-row">${r.complete ? button('stage:beach', '첫 섬으로 출발 →', 'primary') : button('restart', '다시 연습', 'primary')}${button('restart', '한 번 더 연습', 'secondary')}${button('home', '시작 화면', 'secondary')}</div></section></div>`,
        'result',
      );
      return;
    }
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">BUILD YOUR OWN VOYAGE</span><h1 tabindex="-1">${r.complete ? '나만의 코스 완주!' : '다시, 한 번 더!'}</h1><p>${esc(this.custom?.name ?? '')}</p><div class="result-score"><span>이번 항해</span><strong>${r.score.toLocaleString()}</strong><small>별빛 ${r.stars} · HP 손실 ${r.hpLoss}회</small></div>${this.damageSummary()}<p class="muted">나만의 코스는 기록·지도·해금에 반영하지 않아요.</p><div class="button-row">${button('restart', '다시 달리기', 'primary')}${button('maker', '코스 고치기', 'secondary')}${button('maker-share', 'QR로 보내기', 'secondary')}</div></section></div>`,
      'result',
    );
  },
};
