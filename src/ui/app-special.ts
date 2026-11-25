import {dailySpec, dailyPassed, koreanDay} from '../levels/daily';
import {BOSSES} from '../levels/bosses';
import {mergeTrial} from '../storage/expeditions';
import {damageGuidance} from '../systems/damage';
import {ghostDistance} from '../storage/journal';
import {
  decodeLink,
  linkUrl,
  parseLinkText,
  type ContestLink,
  type ContestResult,
  type Link,
  type RivalLink,
  type CourseLink,
} from '../systems/share';
import {contestLength, newContestId, type Entry} from '../storage/contests';
import {buildEndless, sectionsPassed, ENDLESS_SECTIONS} from '../levels/endless';
import {button, esc} from './html';
import {COURSES, STAGES, type StageId} from '../levels/courses';
import {cleanName} from '../storage/profiles';
import {unlocked, courseGhost} from '../storage/save';
import {VARIANT_LABELS} from '../levels/variants';
import {isVariant, type VariantId} from '../levels/course-ids';
import type {DuoCourse} from './duo-view';
import {STAGE_VIEW, regionArt} from '../assets/terrain';
import {prologueCourse, PROLOGUE_TITLE} from '../levels/prologue';
import {HEROES} from '../systems/heroes';
import {recordRun} from '../storage/feats';
import type {MakerDraft} from './maker-view';
import {loadContactMasks} from '../systems/contact';
import {MAKER_SLOTS, buildCustom, checkCustom, isBlocks, randomBlocks, BLOCKS, type BlockId} from '../levels/maker';
import type {App} from './app';
import {pageViews, shareView, contestView, makerView, MAKER_KEY, duoModule, duoView} from './app-shared';
// The special voyages: shared links and QR codes, contests, the course maker, two sailors, the gallery, the prologue, endless and shuffled routes, rivals, bosses and the daily voyage. Methods of App (see ui/app),
// kept here to keep that file readable.
export const specialMethods = {
  // Shared records arrive in the URL fragment; read once and drop it so a reload does not repeat it.
  takeLink(this: App) {
    if (!/^#[gcrm]=/.test(location.hash)) return '';
    const code = location.hash.slice(3);
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {}
    return code;
  },
  openPendingLink(this: App) {
    const code = this.pendingLink;
    this.pendingLink = '';
    if (!code) {
      this.home();
      return;
    }
    let link: Link;
    try {
      link = decodeLink(code);
    } catch (error) {
      this.home();
      this.notice((error as Error).message);
      return;
    }
    this.openLink(link);
  },
  openLink(this: App, link: Link) {
    if (link.kind === 'ghost') this.rivalPage(link);
    else if (link.kind === 'contest') this.contestJoin(link);
    else if (link.kind === 'course') this.makerReceived(link);
    else this.contestCollect(link);
  },
  contestRules(this: App, c: {stage: StageId | null; variant: VariantId | null; assist: boolean; blocks?: string}) {
    return `${c.blocks && c.stage ? `${COURSES[c.stage].name} · 학생이 만든 코스` : c.stage && c.variant ? this.courseName(c.stage, c.variant) : '코스 정보 없음'} · 쉬운 항해 ${c.assist ? '허용' : '끔'}`;
  },
  contestJoin(this: App, link: ContestLink) {
    this.abandon();
    this.world.showHome();
    this.contest = link;
    this.rival = link.leader
      ? {
          kind: 'ghost',
          name: link.leader.name,
          stage: link.stage,
          variant: link.variant,
          score: link.leader.score,
          ghost: link.leader.ghost,
        }
      : null;
    void this.later(contestView, m =>
      this.set(m.contestJoinMarkup(link, this.contestRules(link), this.profiles.active.name), 'contest-join'),
    );
  },
  async contestRun(this: App) {
    const link = this.contest;
    if (!link) return;
    await this.prepare(link.stage, true);
    if (this.screen !== 'prepare' || this.selected !== link.stage || this.contest !== link) return;
    this.special = 'contest';
    this.selectedVariant = link.variant;
    const m = await contestView();
    if (this.screen !== 'prepare' || this.contest !== link) return;
    this.set(m.contestStartMarkup(link, this.contestRules(link), this.profiles.active.name), 'prepare');
  },
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
  duoPage(this: App, message = '') {
    this.abandon();
    this.world.showHome();
    const open = STAGES.filter(id => unlocked(this.store.data, id) && this.lock.lessonOpen(id));
    void this.later(
      () => Promise.all([loadContactMasks(), duoView()]),
      () => {
        this.duoCourses = this.duoCourseList();
        this.set(
          duoModule!.duoPageMarkup(this.header('둘이서 번갈아', 'challenges'), open, message, this.duoCourses),
          'duo',
        );
      },
    );
  },
  duoCourseList(this: App): DuoCourse[] {
    const out: DuoCourse[] = [],
      d = this.loadDraft();
    if (
      d.blocks !== 'f'.repeat(MAKER_SLOTS) &&
      checkCustom(buildCustom(d.stage, d.blocks, d.title || '나만의 코스')).ok
    )
      out.push({stage: d.stage, blocks: d.blocks, title: d.title || '나만의 코스'});
    for (const g of this.gallery.ranked().slice(0, 10))
      if (!out.some(c => c.blocks === g.blocks && c.stage === g.stage))
        out.push({stage: g.stage, blocks: g.blocks, title: g.title || '학생 코스'});
    return out;
  },
  async duoRun(this: App) {
    if (this.screen === 'duo') {
      const a = cleanName(this.ui.querySelector<HTMLInputElement>('#duo-a')?.value ?? ''),
        b = cleanName(this.ui.querySelector<HTMLInputElement>('#duo-b')?.value ?? ''),
        pick = this.ui.querySelector<HTMLSelectElement>('#duo-stage')?.value ?? '',
        course = pick.startsWith('course:') ? this.duoCourses[Number(pick.slice(7))] : undefined,
        stage = (course?.stage ?? pick) as StageId;
      if (!a || !b) return this.setText('#duo-message', '두 항해사의 이름을 적어 주세요.');
      if (!STAGES.includes(stage) || (!course && (!unlocked(this.store.data, stage) || !this.lock.lessonOpen(stage))))
        return;
      const together = !!this.ui.querySelector<HTMLInputElement>('#duo-together')?.checked;
      if (together && this.portrait)
        return this.setText(
          '#duo-message',
          '동시에 달리려면 화면을 가로로 돌려 주세요. 세로 화면은 둘로 나누기엔 너무 좁아요.',
        );
      this.duo = {
        names: [a, b],
        stage,
        scores: [],
        together,
        ...(course ? {course} : {}),
      };
    }
    const d = this.duo;
    if (!d) return;
    // A student course runs like a contest course: its island need not be open on this device.
    await this.prepare(d.stage, !!d.course);
    if (this.screen !== 'prepare' || this.selected !== d.stage || this.duo !== d) return;
    if (d.together) {
      // The second scene loads the same island into its own canvas before the countdown.
      this.set(duoModule!.duoLoadingMarkup(), 'stage-loading');
      const request = ++this.loadRequest;
      try {
        await (await this.split.open()).prepare(d.stage);
      } catch {
        if (request === this.loadRequest)
          this.duoPage('두 번째 화면을 준비하지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
        return;
      }
      if (
        request !== this.loadRequest ||
        (this.screen as string) !== 'stage-loading' ||
        this.duo !== d ||
        this.destroyed
      )
        return;
    }
    this.special = 'duo';
    this.set(duoModule!.duoPrepareMarkup(d), 'prepare');
  },
  // The second sailor runs as a different hero so the two halves read apart at a glance.
  secondHero(this: App) {
    const first = this.store.data.preferences.hero;
    return HEROES.find(h => h.id !== first)!.id;
  },
  finishDuo(this: App) {
    const d = this.duo!,
      r = this.result!;
    this.sound.setPlaying(false);
    this.controls.clear();
    if (d.together && this.run2) {
      d.scores = [r, this.run2.result()];
      this.run2 = null;
      this.split.show(false);
    } else d.scores.push(r);
    if (d.scores.length < 2) this.set(duoModule!.duoTurnMarkup(d, r), 'result');
    else this.set(duoModule!.duoTeamMarkup(d), 'result');
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
  async prologueRun(this: App) {
    await this.prepare('beach');
    if (this.screen !== 'prepare' || this.selected !== 'beach') return;
    this.special = 'custom';
    this.prologue = true;
    this.custom = prologueCourse();
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">PROLOGUE</span><h1 tabindex="-1">🎓 ${PROLOGUE_TITLE}</h1><p>트로이를 떠나는 30초 연습 항해예요. 점프, 숙이기, 몬스터 밟기, 스프링, 밧줄, 추격을 하나씩 해 봐요. 화면 위 안내를 따라가면 돼요.</p><p class="muted">연습이라 기록·지도·해금에는 반영하지 않아요.</p>${button('start', '출발 →', 'primary large')}${button('home', '돌아가기', 'secondary')}</section></div>`,
      'prepare',
    );
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
  endlessCards(this: App) {
    return `<section class="endless-section"><span class="eyebrow">ENDLESS VOYAGE</span><h2>끝없는 항해</h2><p>섬의 여섯 구간이 날마다 다른 순서로 이어져요. 체력이 다할 때까지 얼마나 멀리 갈 수 있을까요? 지도는 나오지 않고 일반 기록과 따로 남겨요.</p><div class="trial-grid stages">${STAGES.map(
      id => {
        const open = this.store.data.stages[id].complete,
          r = this.store.data.endless[id];
        return `<section class="trial-card"><h2>${COURSES[id].name}</h2><p>${r ? `최고 ${Math.floor(r.bestDistance / 10).toLocaleString()}m · ${sectionsPassed(r.bestDistance)}구간 · ${r.bestScore.toLocaleString()}점` : '아직 기록 전'}</p>${button('endless:' + id, open ? '끝없는 항해 출발' : '해당 섬 완주 후 열려요', 'primary', open ? '' : 'disabled')}${open ? button('shuffle:' + id, '🔀 오늘의 셔플 항로', 'secondary') : ''}</section>`;
      },
    ).join('')}</div></section>`;
  },
  async prepareEndless(this: App, id: StageId) {
    if (!this.store.data.stages[id].complete) {
      this.challenges();
      return;
    }
    const date = dailySpec().date;
    await this.prepare(id);
    if (this.screen !== 'prepare' || this.selected !== id) return;
    this.special = 'endless';
    this.endless = {course: buildEndless(id, `${date}:${id}`), date};
    const best = this.store.data.endless[id];
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">ENDLESS VOYAGE · ${date}</span><h1 tabindex="-1">끝없는 ${COURSES[id].name}</h1><p>여섯 구간이 오늘의 순서로 최대 ${ENDLESS_SECTIONS}번 이어져요. 오늘은 모두 같은 순서를 달려요.</p><p>체력 3 · 사과로 회복 · 지도 없음${best ? ` · 나의 최고 ${Math.floor(best.bestDistance / 10).toLocaleString()}m` : ''}</p>${button('start', '출발 →', 'primary large')}${button('challenges', '돌아가기', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  // Today's shuffled route: the six sections once, in an order everyone shares today.
  async prepareShuffle(this: App, id: StageId) {
    if (!this.store.data.stages[id].complete) {
      this.challenges();
      return;
    }
    const date = dailySpec().date;
    await this.prepare(id);
    if (this.screen !== 'prepare' || this.selected !== id) return;
    this.special = 'endless';
    this.endless = {course: buildEndless(id, `shuffle:${date}:${id}`, 6), date, shuffle: true};
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">SHUFFLED ROUTE · ${date}</span><h1 tabindex="-1">🔀 ${COURSES[id].name} 셔플 항로</h1><p>이 섬의 여섯 구간을 오늘의 순서로 한 번씩 이어 달려요. 아는 장애물도 순서가 바뀌면 새로워요.</p><p>체력 3 · 약 75초 · 지도 없음 · 일반 기록과 따로예요</p>${button('start', '출발 →', 'primary large')}${button('challenges', '돌아가기', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  finishShuffle(this: App) {
    const r = this.result!;
    this.sound.setPlaying(false);
    this.controls.clear();
    this.store.data = recordRun(this.store.data, r, koreanDay(), {special: true, weather: false});
    this.store.persist();
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">SHUFFLED ROUTE · ${this.endless!.date}</span><h1 tabindex="-1">${r.complete ? '셔플 항로 완주!' : '다시, 새 순서로!'}</h1><p>${COURSES[r.stage].name}</p><div class="result-score"><span>이번 항해</span><strong>${r.score.toLocaleString()}</strong><small>${Math.floor(r.distance / 10).toLocaleString()}m · 별빛 ${r.stars} · HP 손실 ${r.hpLoss}회</small></div>${this.damageSummary()}<p class="muted">일반 최고 기록·지도·섬 해금에는 반영하지 않아요. 내일은 다른 순서예요.</p><div class="button-row">${button('restart', '다시 출발', 'primary')}${button('challenges', '특별 항해', 'secondary')}${button('home', '시작 화면', 'secondary')}</div></section></div>`,
      'result',
    );
  },
  finishEndless(this: App) {
    if (this.endless?.shuffle) {
      this.finishShuffle();
      return;
    }
    const r = this.result!,
      id = r.stage,
      old = this.store.data.endless[id];
    this.sound.setPlaying(false);
    this.controls.clear();
    const record = {
      bestScore: Math.max(old?.bestScore ?? 0, r.score),
      bestDistance: Math.max(old?.bestDistance ?? 0, Math.floor(r.distance)),
    };
    this.store.data = recordRun(this.store.data, r, koreanDay(), {special: true, weather: false});
    this.store.data.endless[id] = record;
    this.store.persist();
    const meters = Math.floor(r.distance / 10),
      fresh = !old || r.distance > old.bestDistance;
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">ENDLESS VOYAGE · ${this.endless!.date}</span><h1 tabindex="-1">${r.complete ? '끝까지 항해했어요!' : fresh ? '새로운 최고 거리!' : '다시, 더 멀리!'}</h1><p>${COURSES[id].name}</p><div class="result-score"><span>이번 항해</span><strong>${meters.toLocaleString()}m</strong><small>${sectionsPassed(r.distance)}구간 · ${r.score.toLocaleString()}점 · 별빛 ${r.stars}</small></div><p>나의 최고 ${Math.floor(record.bestDistance / 10).toLocaleString()}m · ${record.bestScore.toLocaleString()}점</p>${this.damageSummary()}<p class="muted">일반 최고 기록·지도·섬 해금에는 반영하지 않아요.</p><div class="button-row">${button('restart', '다시 출발', 'primary')}${button('challenges', '특별 항해', 'secondary')}${button('home', '시작 화면', 'secondary')}</div>${button('quiz', '신화 퀴즈 한 문제', 'text-button')}</section></div>`,
      'result',
    );
  },
  finishContest(this: App) {
    const r = this.result!,
      c = this.contest!;
    this.sound.setPlaying(false);
    this.controls.clear();
    const now: Entry = {
        name: this.profiles.active.name,
        score: r.score,
        complete: r.complete,
        stars: r.stars,
        maps: r.maps.length,
        hpLoss: r.hpLoss,
        time: Math.round(this.run!.time * 10) / 10,
        ...(r.adventure?.ghost ? {ghost: r.adventure.ghost} : {}),
      },
      best = this.contests.record(c.id, this.profiles.active.id, now),
      result: ContestResult = {kind: 'result', contest: c.id, ...best},
      url = linkUrl(result, location.href);
    void this.later(contestView, m =>
      this.set(m.contestResultMarkup(c.title, r, best, url, this.rivalLine(r, '1등')), 'result'),
    );
  },
  contestCollect(this: App, result: ContestResult) {
    const {contest, added} = this.contests.add(result);
    this.contestBoard(
      contest.id,
      added
        ? `‘${result.name}’의 결과를 받았어요. 같은 이름은 가장 좋은 기록만 남겨요.`
        : `순위표가 가득 찼어요(최대 인원). 다른 대회를 새로 만들어 주세요.`,
    );
  },
  contestsPage(this: App, message = '') {
    this.abandon();
    this.world.showHome();
    void this.later(contestView, m =>
      this.set(
        m.contestsMarkup(this.header('교사용 대회', 'challenges'), this.contests.book.hosted, message),
        'contests',
      ),
    );
  },
  contestBoard(this: App, id: string, message = '') {
    const c = this.contests.find(id);
    if (!c) {
      this.contestsPage('대회를 찾지 못했어요.');
      return;
    }
    this.abandon();
    this.world.showHome();
    void this.later(contestView, m =>
      this.set(
        m.boardMarkup(this.header(esc(c.title), 'contests'), c, this.contestRules(c), message, location.href),
        'contest-board',
      ),
    );
  },
  stopScanner(this: App) {
    this.scanner?.stop();
    this.scanner = null;
  },
  contestCsv(this: App, id: string) {
    const c = this.contests.find(id);
    if (c)
      void contestView().then(m =>
        this.download(
          m.contestCsv(c.entries, contestLength(c)),
          `odyssey-run-contest-${c.id}.csv`,
          'text/csv;charset=utf-8',
        ),
      );
  },
  contestAction(this: App, kind: string, id = '') {
    const say = (text: string) => {
      const box = this.ui.querySelector('#contest-message');
      if (box) box.textContent = text;
    };
    if (kind === 'create') {
      const title = this.ui.querySelector<HTMLInputElement>('#contest-title')?.value.trim() || '우리 반 대회',
        stage = this.ui.querySelector<HTMLSelectElement>('#contest-stage')!.value as StageId,
        variant = this.ui.querySelector<HTMLSelectElement>('#contest-variant')!.value,
        assist = this.ui.querySelector<HTMLInputElement>('#contest-assist')!.checked;
      if (!STAGES.includes(stage) || !isVariant(variant)) return;
      const c = this.contests.host({id: newContestId(), title: title.slice(0, 12), stage, variant, assist});
      this.contestBoard(c.id, '대회를 만들었어요. 참가 QR을 띄워 주세요.');
    } else if (kind === 'open') this.contestBoard(id);
    else if (kind === 'scan') {
      if (this.scanner) this.stopScanner();
      else
        void contestView().then(m => {
          if (this.screen === 'contest-board' && !this.scanner)
            this.scanner = new m.BoardScanner(this.ui, id, this.contests, () => this.store.data.preferences.haptics);
        });
    } else if (kind === 'csv') this.contestCsv(id);
    else if (kind === 'paste') {
      try {
        const link = parseLinkText(this.ui.querySelector<HTMLInputElement>('#contest-code')?.value ?? '');
        if (link?.kind !== 'result') throw Error('학생 결과 화면의 결과 코드를 붙여 넣어 주세요.');
        this.contestCollect(link);
      } catch (error) {
        say((error as Error).message);
      }
    } else if (kind === 'drop') {
      const [contest, name] = id.split('/');
      this.contests.drop(contest, decodeURIComponent(name ?? ''));
      this.contestBoard(contest, `‘${decodeURIComponent(name ?? '')}’ 기록을 뺐어요. 다시 찍으면 다시 들어가요.`);
    } else if (kind === 'clear') {
      this.contests.clear(id);
      this.contestBoard(id, '순위를 비웠어요.');
    } else if (kind === 'delete') {
      this.contests.remove(id);
      this.contestsPage('대회를 지웠어요.');
    } else if (kind === 'host-here' && this.contest) {
      const c = this.contests.host({...this.contest});
      this.contestBoard(c.id, '이 기기에서 결과를 모아요.');
    } else if (kind === 'run' && this.screen === 'contest-join') void this.contestRun();
  },
  courseName(this: App, stage: StageId, variant: VariantId) {
    return `${COURSES[stage].name} · ${VARIANT_LABELS[stage][variant].name}`;
  },
  rivalPage(this: App, link: RivalLink) {
    this.abandon();
    this.world.showHome();
    this.rival = link;
    const open = unlocked(this.store.data, link.stage);
    this.set(
      `<div class="veil"><section class="panel rival-panel"><span class="eyebrow">A FRIEND’S VOYAGE</span><h1 tabindex="-1">‘${esc(link.name)}’의 기록이 도착했어요</h1><p>${this.courseName(link.stage, link.variant)}</p><div class="result-score"><span>친구의 점수</span><strong>${link.score.toLocaleString()}</strong><small>${Math.floor(link.ghost.samples.at(-1)! / 10)}m · ${Math.floor(link.ghost.duration)}초 항해</small></div><p>같은 코스를 달리면 친구의 배가 진행 막대에 함께 표시돼요.</p>${open ? button('rival-start', '이 기록과 겨루기 →', 'primary large') : `<p class="unlock-hint">${COURSES[link.stage].name}은 아직 잠겨 있어요. 앞선 섬을 먼저 완주해 주세요.</p>`}${button('home', '시작 화면으로', 'secondary')}<small>링크로 받은 기록은 이 기기에서 확인할 수 없어요. 재미로 겨뤄요.</small></section></div>`,
      'rival',
    );
  },
  async rivalStart(this: App) {
    const link = this.rival;
    if (!link || !unlocked(this.store.data, link.stage)) return;
    await this.prepare(link.stage);
    if (this.screen !== 'prepare' || this.selected !== link.stage || this.rival !== link) return;
    this.selectedVariant = link.variant;
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">A FRIEND’S VOYAGE</span><h1 tabindex="-1">‘${esc(link.name)}’의 기록과 나란히</h1><p>${this.courseName(link.stage, link.variant)} · 친구 ${link.score.toLocaleString()}점</p><p>일반 항해와 똑같이 기록·지도·해금이 남아요.</p>${button('start', '출발 →', 'primary large')}${button('home', '그만두기', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  // Where the comparison voyage is now: a friend's link first, else this sailor's best on the course.
  ghostNow(this: App): {x: number; friend: boolean} | null {
    const r = this.run;
    if (!r || (this.special && this.special !== 'contest') || !this.store.data.preferences.ghostRunner) return null;
    const rival = this.rivalFor(this.selected, r.variant);
    if (this.special && !rival) return null;
    const x = ghostDistance(rival?.ghost ?? courseGhost(this.store.data, this.selected, r.variant), r.time);
    return x === null ? null : {x, friend: !!rival};
  },
  rivalFor(this: App, stage: StageId, variant: VariantId) {
    const r = this.rival;
    return (!this.special || this.special === 'contest') && r && r.stage === stage && r.variant === variant ? r : null;
  },
  sharePage(this: App) {
    const r = this.result,
      ghost = r?.adventure?.ghost;
    if (!r || !ghost || this.special) return;
    const url = linkUrl(
      {
        kind: 'ghost',
        name: this.profiles.active.name,
        stage: r.stage,
        variant: r.variant ?? 'classic',
        score: r.score,
        ghost,
      },
      location.href,
    );
    void this.later(shareView, m =>
      this.set(
        m.shareMarkup(this.courseName(r.stage, r.variant ?? 'classic'), r.score, this.profiles.active.name, url),
        'share',
      ),
    );
  },
  shareImage(this: App) {
    const r = this.result;
    if (!r) return;
    return shareView().then(m =>
      m.saveResultPicture(this.ui, {
        view: STAGE_VIEW[r.stage],
        course: this.courseName(r.stage, r.variant ?? 'classic'),
        score: r.score,
        rating: r.rating,
        stars: r.stars,
        maps: r.maps.length,
        complete: r.complete,
        name: this.ui.querySelector<HTMLInputElement>('#card-name')?.checked ? this.profiles.active.name : '',
      }),
    );
  },
  challenges(this: App) {
    this.abandon();
    this.world.showHome();
    this.set(
      `<div class="page challenges">${this.header('특별 항해')}<div class="page-heading"><span class="eyebrow">READ THE PATTERN</span><h1 tabindex="-1">예고를 읽고, 한 번 더!</h1><p>일반 항로의 점수·지도·해금과 별도로 기록해요.</p></div><div class="trial-grid stages">${STAGES.map(
        id => {
          const open = this.store.data.stages[id].complete,
            r = this.store.data.expeditions.bosses[id];
          return `<section class="trial-card">${regionArt(STAGE_VIEW[id], 'prepare-art')}<h2>${BOSSES[id].name}</h2><p>${BOSSES[id].description}</p><small>30초 · 체력 3 · 예고 후 공격 · 아이템 없음</small><p>${r ? `최고 ${r.bestScore}점 · ${r.complete ? '✓ 돌파' : '다시 도전'}` : '아직 도전 전'}</p>${button('boss:' + id, open ? '보스 도전' : '해당 섬 완주 후 열려요', 'primary', open ? '' : 'disabled')}</section>`;
        },
      ).join(
        '',
      )}</div>${this.endlessCards()}${this.dailyCard()}<section class="daily-card"><span class="eyebrow">PROLOGUE</span><h2>🎓 프롤로그: 트로이 탈출</h2><p>점프·숙이기·밟기·스프링·밧줄·추격을 한 칸씩 연습하는 30초 항해예요.${this.store.data.play.prologue ? ' ✓ 연습 완료' : ''}</p>${button('prologue', '연습 항해 출발', 'secondary')}</section><section class="daily-card"><span class="eyebrow">TWO SAILORS, ONE SCREEN</span><h2>👥 둘이서 번갈아 달리기</h2><p>한 화면에서 두 명이 같은 코스를 차례로 달리고 팀 점수를 만들어요.</p>${button('duo', '둘이서 달리기', 'primary')}</section><section class="daily-card"><span class="eyebrow">BUILD YOUR OWN VOYAGE</span><h2>⚒ 나만의 코스 만들기</h2><p>열 칸에 블록을 골라 코스를 만들고 QR로 친구에게 보내요.</p>${button('maker', '코스 만들기', 'primary')}</section><section class="daily-card"><span class="eyebrow">FOR TEACHERS</span><h2>교사용 대회</h2><p>코스를 정해 QR로 학생을 초대하고, 결과 QR을 찍어 순위를 모아요.</p>${button('contests', '대회 열기·순위 보기', 'secondary')}</section></div>`,
      'challenges',
    );
  },
  async prepareBoss(this: App, id: StageId) {
    if (!this.store.data.stages[id].complete) {
      this.challenges();
      return;
    }
    await this.prepare(id);
    if (this.screen !== 'prepare' || this.selected !== id) return;
    this.special = 'boss';
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">BOSS ENCOUNTER</span><h1 tabindex="-1">${BOSSES[id].name}</h1><p>${BOSSES[id].description}</p><ol>${BOSSES[id].phases.map(p => `<li>${p}</li>`).join('')}</ol><p>30초 · 아이템 없음 · 체력과 점프는 일반 항해와 같아요.<br>보스 도전의 최고 기록만 남겨요.</p>${button('start', '보스 도전 시작', 'primary')}${button('challenges', '돌아가기', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  dailyCard(this: App) {
    const d = dailySpec(),
      r = this.store.data.expeditions.daily.find(r => r.date === d.date);
    return `<section class="daily-card"><span class="eyebrow">TODAY’S VOYAGE · ${d.date} 한국 날짜</span><h2>${d.name}</h2><p>${d.description}</p><p>출항의 해변 · ${VARIANT_LABELS.beach[d.variant].name} · 약 75초</p><p>${r ? `최고 ${r.bestScore}점 · ${r.complete ? '✓ 오늘 도전 성공' : '다시 도전할 수 있어요'}` : '오늘의 첫 항해를 시작해 보세요.'}</p>${button('daily', '오늘의 항해 시작', 'primary')}<small>기기 시각을 사용해요. 최근 14일을 보관하며 온라인 순위는 제공하지 않아요.</small></section>`;
  },
  async prepareDaily(this: App) {
    const d = dailySpec();
    await this.prepare('beach');
    if (this.screen !== 'prepare' || this.selected !== 'beach') return;
    this.special = 'daily';
    this.daily = d;
    this.selectedVariant = d.variant;
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">TODAY’S VOYAGE · ${d.date}</span><h1 tabindex="-1">${d.name}</h1><p>${d.description}</p><p>${VARIANT_LABELS.beach[d.variant].name} · 체력 3 · 약 75초<br>오늘의 기록만 남기며 일반 기록과 해금은 바꾸지 않아요.</p>${button('start', '오늘의 항해 달리기', 'primary')}${button('challenges', '돌아가기', 'secondary')}</section></div>`,
      'prepare',
    );
  },
  finishSpecial(this: App) {
    if (this.special === 'contest') {
      this.finishContest();
      return;
    }
    if (this.special === 'endless') {
      this.finishEndless();
      return;
    }
    if (this.special === 'custom') {
      this.finishCustom();
      return;
    }
    if (this.special === 'duo') {
      this.finishDuo();
      return;
    }
    const r = this.result!,
      e = this.store.data.expeditions,
      boss = this.special === 'boss',
      passed = boss ? r.complete : dailyPassed(this.daily!, r);
    this.sound.setPlaying(false);
    this.controls.clear();
    let best: number;
    if (boss) {
      e.bosses[r.stage] = mergeTrial(e.bosses[r.stage], r, passed);
      best = e.bosses[r.stage]!.bestScore;
    } else {
      const date = this.daily!.date,
        record = {
          ...mergeTrial(
            e.daily.find(d => d.date === date),
            r,
            passed,
          ),
          date,
        };
      e.daily = [record, ...e.daily.filter(d => d.date !== date)]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14);
      best = record.bestScore;
    }
    // After the trial is merged: recordRun returns a copy, and e points into the current one.
    this.store.data = recordRun(this.store.data, r, koreanDay(), {special: true, weather: false});
    this.store.persist();
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">${boss ? 'BOSS ENCOUNTER' : 'TODAY’S VOYAGE · ' + this.daily!.date}</span><h1 tabindex="-1">${passed ? (boss ? '보스의 패턴을 돌파했어요!' : '오늘의 항해 성공!') : r.complete ? '완주했어요! 다음엔 조건도 달성해 봐요' : '다시, 패턴을 읽어 봐요'}</h1><p>${boss ? BOSSES[r.stage].name : this.daily!.name}</p>${boss && this.run ? `<p class="boss-weak">⚔ 보스 약점 ${this.run.weakHits.size}/${this.run.weakPoints.length}${this.run.bossHp === 0 ? ' · 완전 격파!' : ''}</p>` : ''}<div class="result-score"><strong>${r.score}</strong><small>이 도전의 최고 ${best}점</small></div><p>HP 손실 ${r.hpLoss}회 · 별빛 ${r.stars}개 · ${Math.floor(r.distance / 10)}m / ${this.run!.length / 10}m</p>${!boss && !passed ? `<p>${this.daily!.description}</p>` : ''}${this.damageSummary()}<p>일반 최고 기록·지도·섬 해금에는 반영하지 않아요.</p><div class="button-row">${button('restart', '재도전', 'primary')}${button('challenges', '특별 항해', 'secondary')}${button('home', '시작 화면', 'secondary')}</div>${button('quiz', '신화 퀴즈 한 문제', 'text-button')}</section></div>`,
      'result',
    );
  },
  damageSummary(this: App) {
    const events = this.run?.damageLog ?? [];
    if (!events.length) return '';
    const last = damageGuidance(events.at(-1)!);
    return `<section class="damage-summary"><h2>다음 항해의 힌트</h2><p>마지막 HP 손실: <b>${last.name}</b> · ${last.meters}m 지점</p><p>${last.hint}</p><small>방패 방어는 HP 손실에 포함하지 않아요. 회복해도 피해 이력은 남아요.</small></section>`;
  },
};
