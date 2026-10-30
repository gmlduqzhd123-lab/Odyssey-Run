import {Offline} from '../systems/offline';
import {getLang, initialLang, LANGS, observe, setLang, translate, translateTree, type Lang} from '../i18n';
import {dailySpec, dailyPassed, type DailySpec} from '../levels/daily';
import {COSMETICS, cosmeticUnlocked} from '../systems/cosmetics';
import {BOSSES, BOSS_COURSES} from '../levels/bosses';
import {mergeTrial} from '../storage/expeditions';
import {damageGuidance} from '../systems/damage';
import {defaultPreferences, PACES, type Assist, type Pace, type Quality} from '../storage/preferences';
import {ADVENTURE_PLANS, GOALS, stampIds, constellationIds, storyIds, type GoalId} from '../levels/adventure';
import {ghostDistance} from '../storage/journal';
import {QUIZ, type QuizQuestion} from '../levels/quiz';
import {
  decodeLink,
  linkUrl,
  parseLinkText,
  qrSvg,
  type ContestLink,
  type ContestResult,
  type Link,
  type RivalLink,
} from '../systems/share';
import {Contests, newContestId, type Entry} from '../storage/contests';
import {
  backupAge,
  backupReminder,
  iosBrowserTab,
  markBackup,
  protection,
  requestProtection,
  type Protection,
} from '../storage/durability';
import {dropSpareCopies, spareCopies, storageUse, STORAGE_LIMIT} from '../storage/durability';
import {classBackup, readClassBackup, restoreClass, CLASS_BACKUP_LIMIT, type ClassBackup} from '../storage/backup';
import {buildEndless, sectionsPassed, ENDLESS_SECTIONS} from '../levels/endless';
import type {Course} from '../levels/courses';
import {button, esc, icon} from './html';
import {
  bookNav,
  codexPage,
  landscapesPage,
  sheetPage,
  peoplePage,
  personPage,
  relicsPage,
  bestiaryPage,
  TOTAL_MAPS,
} from './book-view';
import {harborArt, harborUnlocks, harborRequirements, journalCards} from './adventure-view';
import Phaser from 'phaser';
import {C} from '../config';
import {COURSES, STAGES, MAP_STORIES, type StageId} from '../levels/courses';
import {Runner} from '../player/runner';
import {Profiles, profileKey, readBook, PROFILES_KEY, MAX_NAME, MAX_PROFILES, MAIN_PROFILE} from '../storage/profiles';
import {
  SaveStore,
  mergeResult,
  unlocked,
  validateSave,
  courseRecord,
  courseGhost,
  type Save,
  type RunResult,
  type Settings,
  SAVE_KEY,
} from '../storage/save';
import {VARIANTS, VARIANT_LABELS} from '../levels/variants';
import {isVariant, type VariantId} from '../levels/course-ids';
import {Controls} from '../input/controls';
import {Sound} from '../systems/audio';
import {vibrate} from '../systems/haptics';
import {deviceReducedMotion, followDevice} from '../systems/device-prefs';
import {resultCard} from './result-card';
import {keepLanguage} from '../systems/lang-cache';
import {classPreviewMarkup, importPreviewMarkup, settingToggle, settingsMarkup} from './settings-view';
import {progressCsv, progressMarkup} from './progress-view';
import {BoardScanner, boardMarkup, contestCsv, contestsMarkup} from './contest-view';
import {World} from '../scenes/World';
import {assetUrl, STAGE_RELIC} from '../assets/catalog';
import {STAGE_VIEW, regionArt} from '../assets/terrain';
import {displayDensity, displayViewport} from '../rendering/display';
import {FrameWatch} from '../rendering/frame-watch';
const asset = assetUrl;
const SLOW_KEY = SAVE_KEY + ':slow-device';
// Logical width of the portrait game strip (4:3): closer than the landscape 960 so the hero and
// hazards are drawn larger on a phone held upright.
const PORTRAIT_VIEW = 720;
export class App {
  private ui = document.querySelector<HTMLDivElement>('#ui')!;
  private store: SaveStore;
  private profiles: Profiles;
  private storage: Storage | null = null;
  private pendingDelete = '';
  private world: World;
  private game: Phaser.Game;
  private offline: Offline;
  private controls: Controls;
  private sound: Sound;
  private run: Runner | null = null;
  private result: RunResult | null = null;
  private screen = 'loading';
  private returnScreen = 'home';
  private selected: StageId = 'beach';
  private accumulator = 0;
  private countdown = 0;
  private imported: Save | null = null;
  private classImport: ClassBackup | null = null;
  private lastHud = '';
  private destroyed = false;
  private abort = new AbortController();
  private view = displayViewport(
    document.querySelector('#shell')!.getBoundingClientRect().width,
    document.querySelector('#shell')!.getBoundingClientRect().height,
  );
  private renderDensity = displayDensity(
    document.querySelector('#shell')!.getBoundingClientRect().width,
    window.devicePixelRatio,
    document.querySelector('#shell')!.getBoundingClientRect().height,
  );
  private displayObserver: ResizeObserver;
  private daily: DailySpec | null = null;
  private special: 'boss' | 'daily' | 'contest' | 'endless' | null = null;
  private endless: {course: Course; date: string} | null = null;
  private contests: Contests;
  private contest: ContestLink | null = null;
  private loadRequest = 0;
  private controlsReturn = false;
  private importRequest = 0;
  private selectedGoal: GoalId = 'maps';
  private selectedVariant: VariantId = 'classic';
  private question: QuizQuestion | null = null;
  private quizReturn = 'islands';
  private rival: RivalLink | null = null;
  private pendingLink = '';
  private protectionState: Protection = 'unsupported';
  private protectionAsked = false;
  private reminded = false;
  private frameWatch = new FrameWatch();
  constructor() {
    let storage: Storage | null = null;
    try {
      storage = localStorage;
    } catch {}
    this.storage = storage;
    setLang(initialLang(storage));
    const roots = ['#ui', '#notice', '#game', 'footer'].map(s => document.querySelector(s)).filter(e => !!e);
    roots.forEach(translateTree);
    observe(...roots);
    document.title = translate(document.title);
    followDevice(document.querySelector('#app')!, this.abort.signal);
    void keepLanguage(getLang());
    this.pendingLink = this.takeLink();
    void protection().then(p => (this.protectionState = p));
    // A link opened in a tab that already runs the game only changes the fragment.
    window.addEventListener(
      'hashchange',
      () => {
        const code = this.takeLink();
        if (!code || this.screen === 'loading') return;
        if (['play', 'countdown'].includes(this.screen)) this.pause();
        this.pendingLink = code;
        this.openPendingLink();
      },
      {signal: this.abort.signal},
    );
    this.profiles = new Profiles(storage);
    this.contests = new Contests(storage);
    this.store = new SaveStore(storage, profileKey(this.profiles.active.id));
    this.renderDensity = displayDensity(
      document.querySelector('#shell')!.clientWidth,
      devicePixelRatio,
      document.querySelector('#shell')!.clientHeight,
      this.quality(),
    );
    this.selected = this.store.data.lastStage;
    this.sound = new Sound(() => this.store.data.settings);
    this.controls = new Controls({
      jump: () => {
        this.sound.unlock();
        this.run?.jump();
      },
      slide: held => this.run?.slide(held),
      pause: () => this.pause(),
      active: () => this.screen === 'play' && this.run?.state === 'playing',
      pauseActive: () => ['play', 'countdown'].includes(this.screen),
      slideToggle: () => this.assist().slideToggle,
    });
    this.world = new World({
      frame: d => this.frame(d),
      loaded: () => this.openPendingLink(),
      loadError: () => this.error(),
      reduced: () => this.store.data.settings.reducedMotion || deviceReducedMotion(),
      density: () => this.renderDensity,
      view: () => this.view,
      cosmetics: () => this.store.data.preferences,
    });
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: 'game',
      width: Math.round(this.view.width * this.renderDensity),
      height: Math.round(this.view.height * this.renderDensity),
      backgroundColor: '#102f46',
      scene: this.world,
      scale: {mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
      render: {antialias: true, roundPixels: false, clearBeforeRender: false},
      audio: {noAudio: true},
      fps: {smoothStep: false, target: 60},
      banner: false,
    });
    this.offline = new Offline(
      () => (!!this.run && !this.result) || this.screen === 'stage-loading',
      () => {
        if (!this.destroyed && this.screen === 'offline') this.offlineChanged();
        else if (!this.destroyed && this.offline?.waiting && ['home', 'islands', 'result'].includes(this.screen))
          if (this.screen === 'home') this.home();
          else
            this.notice(this.store.warning || '새 버전이 준비됐어요. 시작 화면에서 「지금 업데이트」를 눌러 주세요.');
      },
    );
    this.displayObserver = new ResizeObserver(() => this.resizeDisplay());
    this.displayObserver.observe(document.querySelector('#shell')!);
    // In portrait play the game strip is smaller than the shell; the canvas follows the strip.
    this.displayObserver.observe(document.querySelector('#game')!);
    this.ui.addEventListener(
      'click',
      e => {
        const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
        if (b && !b.hasAttribute('disabled')) {
          this.sound.unlock();
          this.action(b.dataset.action!);
        }
      },
      {signal: this.abort.signal},
    );
    this.ui.addEventListener('change', e => this.change(e), {signal: this.abort.signal});
    this.ui.addEventListener('input', e => this.layoutInput(e), {signal: this.abort.signal});
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.suspend();
      },
      {signal: this.abort.signal},
    );
    window.addEventListener('blur', () => this.suspend(), {signal: this.abort.signal});
    window.addEventListener('storage', e => this.otherTab(e), {signal: this.abort.signal});
    window.addEventListener(
      'resize',
      () => {
        this.orientation();
        this.resizeDisplay();
      },
      {signal: this.abort.signal},
    );
    window.addEventListener('pagehide', () => this.suspend(), {signal: this.abort.signal});
    // Safari can restore a page from its back/forward cache without a resize.
    // Refresh the touch viewport, and retain the explicit paused resume screen.
    window.addEventListener(
      'pageshow',
      e => {
        if (e.persisted) this.suspend();
        this.orientation();
        this.resizeDisplay();
      },
      {signal: this.abort.signal},
    );
    document.addEventListener(
      'fullscreenchange',
      () => {
        this.orientation();
        this.resizeDisplay();
      },
      {signal: this.abort.signal},
    );
    window.visualViewport?.addEventListener(
      'resize',
      () => {
        this.orientation();
        this.resizeDisplay();
      },
      {signal: this.abort.signal},
    );
  }
  private sharedNotice = false;
  // Another tab saved: fold its progress in now (saving also merges, so nothing is lost either way).
  private otherTab(e: StorageEvent) {
    if (e.key === PROFILES_KEY) {
      const active = this.profiles.active.id;
      this.profiles.book = readBook(e.newValue);
      if (this.profiles.book.list.some(p => p.id === active)) this.profiles.book.active = active;
      return;
    }
    if (e.key !== this.store.key || !this.store.adopt(e.newValue)) return;
    if (this.screen === 'home') this.home();
    else if (this.screen === 'islands') this.islands();
    if (!this.sharedNotice) {
      this.sharedNotice = true;
      this.notice('같은 항해사가 다른 탭에서도 열려 있어요. 두 탭의 기록은 합쳐서 저장해요.');
    }
  }
  private notice(message = this.store.warning) {
    const n = document.querySelector<HTMLElement>('#notice')!;
    n.textContent = message;
    n.hidden = !message;
  }
  private set(html: string, screen: string) {
    this.importRequest++;
    this.stopScanner();
    this.screen = screen;
    document.querySelector<HTMLElement>('#app')!.dataset.screen = screen;
    this.controls.clear();
    this.run?.clearInput();
    this.ui.innerHTML = html;
    const play = this.ui.querySelector<HTMLElement>('.play-ui');
    if (play) play.inert = ['pause', 'countdown'].includes(screen);
    this.lastHud = '';
    this.applyLayout();
    this.orientation();
    this.notice();
    queueMicrotask(() =>
      this.ui.querySelector<HTMLElement>('[autofocus], h1[tabindex], h2[tabindex]')?.focus({preventScroll: true}),
    );
  }
  private async fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen({navigationUI: 'hide'});
      else {
        this.notice('브라우저 화면에 맞춰 표시 중이에요. 이 브라우저는 전체 화면 전환을 지원하지 않아요.');
      }
    } catch {
      this.notice('전체 화면으로 전환하지 못했어요. 현재 브라우저 화면으로 계속 플레이할 수 있어요.');
    }
    this.resizeDisplay();
    if (this.screen === 'play') this.ui.querySelector<HTMLElement>('.play-ui')?.focus({preventScroll: true});
  }
  // On phones and tablets a run fills the whole screen: the browser's bars are hidden and Android
  // turns to landscape. Must run inside the tap that starts the run (browsers require a gesture).
  private immersive() {
    const p = this.store.data.preferences;
    if (
      !p.autoFullscreen ||
      document.fullscreenElement ||
      !document.fullscreenEnabled ||
      !matchMedia('(pointer: coarse)').matches ||
      matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
    )
      return;
    document.documentElement
      .requestFullscreen({navigationUI: 'hide'})
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & {lock?: (o: string) => Promise<void>};
        orientation.lock?.('landscape').catch(() => {});
        this.resizeDisplay();
      })
      .catch(() => {});
  }
  private header(label: string, back = 'home') {
    return `<header class="topbar">${button(back, '← <span>돌아가기</span>', 'text-button')}<span class="brand">${icon('compass')} ${label}</span><span class="edition">ODYSSEY RUN / VOL. 01</span><span class="ys-key"><label class="ys-chip lang-pick" translate="no"><span aria-hidden="true">🌐 ${LANGS.find(l => l.id === getLang())!.short}</span><select data-lang aria-label="Language · 언어">${LANGS.map(l => `<option value="${l.id}" lang="${l.html}" ${l.id === getLang() ? 'selected' : ''}>${l.name}</option>`).join('')}</select></label>${button('profiles', `👤 <span class="ys-wide">${esc(this.profiles.active.name)}</span>`, 'ys-chip', `aria-label="항해사 ${esc(this.profiles.active.name)}, 바꾸기"`)}${button('fullscreen', '⛶ <span class="ys-wide">전체 화면</span>', 'ys-chip', 'aria-label="전체 화면 전환"')}<button type="button" class="ys-chip" data-ys-install>📲 <span class="ys-wide">앱 </span>설치</button><button type="button" class="ys-chip" data-qr aria-label="QR 코드로 접속">📱 QR</button></span></header>`;
  }
  // Shared records arrive in the URL fragment; read once and drop it so a reload does not repeat it.
  private takeLink() {
    if (!/^#[gcr]=/.test(location.hash)) return '';
    const code = location.hash.slice(3);
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch {}
    return code;
  }
  private openPendingLink() {
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
  }
  private openLink(link: Link) {
    if (link.kind === 'ghost') this.rivalPage(link);
    else if (link.kind === 'contest') this.contestJoin(link);
    else this.contestCollect(link);
  }
  private contestRules(c: {stage: StageId | null; variant: VariantId | null; assist: boolean}) {
    return `${c.stage && c.variant ? this.courseName(c.stage, c.variant) : '코스 정보 없음'} · 쉬운 항해 ${c.assist ? '허용' : '끔'}`;
  }
  private contestJoin(link: ContestLink) {
    this.abandon();
    this.world.showHome();
    this.contest = link;
    this.set(
      `<div class="veil"><section class="panel contest-panel"><span class="eyebrow">CLASS CONTEST</span><h1 tabindex="-1">${esc(link.title)}</h1><p>${this.contestRules(link)}</p><p>항해사: <b>${esc(this.profiles.active.name)}</b> ${button('profiles', '바꾸기', 'text-button')}</p><p class="muted">대회 기록은 일반 기록·지도·해금에 반영하지 않아요. 잠긴 섬도 대회에서는 달릴 수 있어요. 끝나면 결과 QR을 선생님께 보여 주세요.</p>${button('contest-run', '대회 달리기 →', 'primary large')}<div class="button-row">${button('contest-host-here', '선생님: 이 기기에서 결과 모으기', 'secondary')}${button('home', '시작 화면으로', 'secondary')}</div></section></div>`,
      'contest-join',
    );
  }
  private async contestRun() {
    const link = this.contest;
    if (!link) return;
    await this.prepare(link.stage, true);
    if (this.screen !== 'prepare' || this.selected !== link.stage || this.contest !== link) return;
    this.special = 'contest';
    this.selectedVariant = link.variant;
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">CLASS CONTEST</span><h1 tabindex="-1">${esc(link.title)}</h1><p>${this.contestRules(link)}</p><p>항해사 <b>${esc(this.profiles.active.name)}</b> · 몇 번이든 다시 달릴 수 있고, 가장 좋은 기록을 보여 줄 수 있어요.</p>${button('start', '출발 →', 'primary large')}${button('home', '그만두기', 'secondary')}</section></div>`,
      'prepare',
    );
  }
  private endlessCards() {
    return `<section class="endless-section"><span class="eyebrow">ENDLESS VOYAGE</span><h2>끝없는 항해</h2><p>섬의 여섯 구간이 날마다 다른 순서로 이어져요. 체력이 다할 때까지 얼마나 멀리 갈 수 있을까요? 지도는 나오지 않고 일반 기록과 따로 남겨요.</p><div class="trial-grid stages">${STAGES.map(
      id => {
        const open = this.store.data.stages[id].complete,
          r = this.store.data.endless[id];
        return `<section class="trial-card"><h2>${COURSES[id].name}</h2><p>${r ? `최고 ${Math.floor(r.bestDistance / 10).toLocaleString()}m · ${sectionsPassed(r.bestDistance)}구간 · ${r.bestScore.toLocaleString()}점` : '아직 기록 전'}</p>${button('endless:' + id, open ? '끝없는 항해 출발' : '해당 섬 완주 후 열려요', 'primary', open ? '' : 'disabled')}</section>`;
      },
    ).join('')}</div></section>`;
  }
  private async prepareEndless(id: StageId) {
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
  }
  private finishEndless() {
    const r = this.result!,
      id = r.stage,
      old = this.store.data.endless[id];
    this.sound.setPlaying(false);
    this.controls.clear();
    const record = {
      bestScore: Math.max(old?.bestScore ?? 0, r.score),
      bestDistance: Math.max(old?.bestDistance ?? 0, Math.floor(r.distance)),
    };
    this.store.data.endless[id] = record;
    this.store.persist();
    const meters = Math.floor(r.distance / 10),
      fresh = !old || r.distance > old.bestDistance;
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">ENDLESS VOYAGE · ${this.endless!.date}</span><h1 tabindex="-1">${r.complete ? '끝까지 항해했어요!' : fresh ? '새로운 최고 거리!' : '다시, 더 멀리!'}</h1><p>${COURSES[id].name}</p><div class="result-score"><span>이번 항해</span><strong>${meters.toLocaleString()}m</strong><small>${sectionsPassed(r.distance)}구간 · ${r.score.toLocaleString()}점 · 별빛 ${r.stars}</small></div><p>나의 최고 ${Math.floor(record.bestDistance / 10).toLocaleString()}m · ${record.bestScore.toLocaleString()}점</p>${this.damageSummary()}<p class="muted">일반 최고 기록·지도·섬 해금에는 반영하지 않아요.</p><div class="button-row">${button('restart', '다시 출발', 'primary')}${button('challenges', '특별 항해', 'secondary')}${button('home', '시작 화면', 'secondary')}</div>${button('quiz', '신화 퀴즈 한 문제', 'text-button')}</section></div>`,
      'result',
    );
  }
  private finishContest() {
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
      },
      best = this.contests.record(c.id, this.profiles.active.id, now),
      result: ContestResult = {kind: 'result', contest: c.id, ...best},
      url = linkUrl(result, location.href);
    this.set(
      `<div class="veil"><section class="panel result contest-result"><span class="eyebrow">CLASS CONTEST · ${esc(c.title)}</span><h1 tabindex="-1">${r.complete ? '대회 코스 완주!' : '대회 기록을 남겼어요'}</h1><div class="result-score"><span>이번 점수</span><strong>${r.score.toLocaleString()}</strong><small>나의 대회 최고 ${best.score.toLocaleString()} · ${esc(best.name)}</small></div><p>별빛 ${r.stars} · 지도 ${r.maps.length} · HP 손실 ${r.hpLoss}회</p><div class="qr-box" role="img" aria-label="대회 결과 QR 코드">${qrSvg(url)}</div><p class="muted">선생님이 휴대폰 카메라로 찍으면 순위표에 들어가요. 가장 좋은 기록이 담겨 있어요.</p><label class="share-url">결과 코드 <input id="share-url" readonly value="${esc(url)}"></label><p role="status" id="share-status"></p><div class="button-row">${button('restart', '다시 달리기', 'primary')}${button('share-copy', '코드 복사', 'secondary')}${button('home', '시작 화면', 'secondary')}</div></section></div>`,
      'result',
    );
  }
  private contestCollect(result: ContestResult) {
    const {contest, added} = this.contests.add(result);
    this.contestBoard(
      contest.id,
      added
        ? `‘${result.name}’의 결과를 받았어요. 같은 이름은 가장 좋은 기록만 남겨요.`
        : `순위표가 가득 찼어요(최대 인원). 다른 대회를 새로 만들어 주세요.`,
    );
  }
  private contestsPage(message = '') {
    this.abandon();
    this.world.showHome();
    this.set(contestsMarkup(this.header('교사용 대회', 'challenges'), this.contests.book.hosted, message), 'contests');
  }
  private contestBoard(id: string, message = '') {
    const c = this.contests.find(id);
    if (!c) {
      this.contestsPage('대회를 찾지 못했어요.');
      return;
    }
    this.abandon();
    this.world.showHome();
    const join =
      c.stage && c.variant
        ? linkUrl(
            {kind: 'contest', id: c.id, title: c.title, stage: c.stage, variant: c.variant, assist: c.assist},
            location.href,
          )
        : '';
    this.set(
      boardMarkup(this.header(esc(c.title), 'contests'), c, this.contestRules(c), join, message),
      'contest-board',
    );
  }
  private scanner: BoardScanner | null = null;
  private stopScanner() {
    this.scanner?.stop();
    this.scanner = null;
  }
  private contestCsv(id: string) {
    const c = this.contests.find(id);
    if (c) this.download(contestCsv(c.entries), `odyssey-run-contest-${c.id}.csv`, 'text/csv;charset=utf-8');
  }
  private contestAction(kind: string, id = '') {
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
      else this.scanner = new BoardScanner(this.ui, id, this.contests, () => this.store.data.preferences.haptics);
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
  }
  private courseName(stage: StageId, variant: VariantId) {
    return `${COURSES[stage].name} · ${VARIANT_LABELS[stage][variant].name}`;
  }
  private rivalPage(link: RivalLink) {
    this.abandon();
    this.world.showHome();
    this.rival = link;
    const open = unlocked(this.store.data, link.stage);
    this.set(
      `<div class="veil"><section class="panel rival-panel"><span class="eyebrow">A FRIEND’S VOYAGE</span><h1 tabindex="-1">‘${esc(link.name)}’의 기록이 도착했어요</h1><p>${this.courseName(link.stage, link.variant)}</p><div class="result-score"><span>친구의 점수</span><strong>${link.score.toLocaleString()}</strong><small>${Math.floor(link.ghost.samples.at(-1)! / 10)}m · ${Math.floor(link.ghost.duration)}초 항해</small></div><p>같은 코스를 달리면 친구의 배가 진행 막대에 함께 표시돼요.</p>${open ? button('rival-start', '이 기록과 겨루기 →', 'primary large') : `<p class="unlock-hint">${COURSES[link.stage].name}은 아직 잠겨 있어요. 앞선 섬을 먼저 완주해 주세요.</p>`}${button('home', '시작 화면으로', 'secondary')}<small>링크로 받은 기록은 이 기기에서 확인할 수 없어요. 재미로 겨뤄요.</small></section></div>`,
      'rival',
    );
  }
  private async rivalStart() {
    const link = this.rival;
    if (!link || !unlocked(this.store.data, link.stage)) return;
    await this.prepare(link.stage);
    if (this.screen !== 'prepare' || this.selected !== link.stage || this.rival !== link) return;
    this.selectedVariant = link.variant;
    this.set(
      `<div class="veil"><section class="panel"><span class="eyebrow">A FRIEND’S VOYAGE</span><h1 tabindex="-1">‘${esc(link.name)}’의 기록과 나란히</h1><p>${this.courseName(link.stage, link.variant)} · 친구 ${link.score.toLocaleString()}점</p><p>일반 항해와 똑같이 기록·지도·해금이 남아요.</p>${button('start', '출발 →', 'primary large')}${button('home', '그만두기', 'secondary')}</section></div>`,
      'prepare',
    );
  }
  private rivalFor(stage: StageId, variant: VariantId) {
    const r = this.rival;
    return !this.special && r && r.stage === stage && r.variant === variant ? r : null;
  }
  private sharePage() {
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
    this.set(
      `<div class="veil"><section class="panel share-panel"><span class="eyebrow">SHARE YOUR VOYAGE</span><h1 tabindex="-1">친구에게 기록 보내기</h1><p>${this.courseName(r.stage, r.variant ?? 'classic')} · ${r.score.toLocaleString()}점 · ${esc(this.profiles.active.name)}</p><div class="qr-box" role="img" aria-label="기록 링크 QR 코드">${qrSvg(url)}</div><p class="muted">친구가 휴대폰 카메라로 찍거나 링크를 열면 이 기록과 겨룰 수 있어요. 서버로 보내지 않고 링크 안에만 담겨요.</p><label class="share-url">링크 <input id="share-url" readonly value="${esc(url)}"></label><div class="button-row">${button('share-copy', '링크 복사', 'secondary')}${'share' in navigator ? button('share-native', '휴대폰으로 공유', 'secondary') : ''}${button('share-image', '🖼 그림으로 저장', 'secondary')}</div><label class="toggle card-name"><span>그림에 내 이름 넣기</span><input type="checkbox" id="card-name"><i aria-hidden="true"></i></label><p role="status" id="share-status"></p><div class="button-row">${button('restart', '재도전', 'primary')}${button('islands', '섬 선택', 'secondary')}</div></section></div>`,
      'share',
    );
  }
  private async shareImage() {
    const r = this.result,
      status = this.ui.querySelector('#share-status');
    if (!r || !status) return;
    status.textContent = '그림을 만들고 있어요…';
    try {
      const blob = await resultCard({
        view: STAGE_VIEW[r.stage],
        course: this.courseName(r.stage, r.variant ?? 'classic'),
        score: r.score,
        rating: r.rating,
        stars: r.stars,
        maps: r.maps.length,
        complete: r.complete,
        name: this.ui.querySelector<HTMLInputElement>('#card-name')?.checked ? this.profiles.active.name : '',
      });
      const name = `odyssey-run-${r.stage}-${r.score}.png`,
        file = new File([blob], name, {type: 'image/png'});
      // Phones (iPhone Safari above all) save a picture to the photo library only through the
      // share sheet; a download there opens the picture in a tab instead.
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({files: [file]})) {
        status.textContent = '공유 창에서 「이미지 저장」을 고르면 사진에 저장돼요.';
        try {
          await navigator.share({files: [file], title: '오디세이 런 기록'});
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      this.download(blob, name, 'image/png');
      status.textContent = '그림을 저장했어요. 학급 게시판이나 메시지에 올릴 수 있어요.';
    } catch {
      status.textContent = '그림을 만들지 못했어요. 화면을 캡처해 주세요.';
    }
  }
  private async shareAction(kind: 'copy' | 'native') {
    const url = this.ui.querySelector<HTMLInputElement>('#share-url')?.value,
      status = this.ui.querySelector('#share-status');
    if (!url || !status) return;
    try {
      if (kind === 'copy') {
        await navigator.clipboard.writeText(url);
        status.textContent = '링크를 복사했어요.';
      } else {
        await navigator.share({title: '오디세이 런 기록', text: '내 기록과 겨뤄 볼래?', url});
        status.textContent = '';
      }
    } catch {
      if (kind === 'copy') {
        this.ui.querySelector<HTMLInputElement>('#share-url')?.select();
        status.textContent = '자동 복사가 막혔어요. 선택된 링크를 직접 복사해 주세요.';
      }
    }
  }
  home() {
    this.rival = null;
    this.abandon();
    this.world.showHome();
    const done = STAGES.every(id => this.store.data.stages[id].complete);
    this.set(
      `<div class="home">${this.header('ODYSSEY RUN', 'home')}<div class="home-copy"><span class="eyebrow"><i></i> 작은 영웅의 긴 귀환</span><h1 tabindex="-1">오디세이 런<span>이타카로!</span></h1><p>별자리를 잇고, 숨은 이야기를 찾고,<br>우리만의 항구를 완성하러 떠나요.</p><div class="home-actions">${button('islands', '항해 시작 <span>↗</span>', 'primary large')}${button('codex', icon('map') + ' 지도 도감', 'secondary')}</div><div class="home-status">${done ? '⚑ 귀환 완료 · ' : ''}도장 ${this.store.data.journal.stamps.length}/${stampIds.length} · 별자리 ${this.store.data.journal.constellations.length}/${constellationIds.length} · 이야기 ${this.store.data.journal.stories.length}/${storyIds.length}</div>${this.offline?.waiting ? `<div class="update-bar" role="status"><span>새 버전이 준비됐어요.</span>${button('update', '지금 업데이트', 'secondary')}</div>` : ''}</div><div class="hero-caption"><span>ODYSSEUS</span><b>지혜로운 작은 영웅</b><i>“이번에는 꼭, 이타카로!”</i></div><div class="home-bottom">${button('challenges', '⚔ 특별 항해', 'text-button')}${button('wardrobe', '♧ 영웅의 옷장', 'text-button')}${button('harbor', '⚓ 나의 항구', 'text-button')}${button('journal', '✧ 모험 수첩', 'text-button')}${button('settings', '⚙ 설정', 'text-button')}${button('quit', '게임 종료', 'text-button')}</div></div>`,
      'home',
    );
    if (!this.reminded) {
      this.reminded = true;
      const message = backupReminder(
        this.storage,
        this.profiles.book.list.length > 1 || this.contests.book.hosted.length > 0,
      );
      if (storageUse(this.storage) > STORAGE_LIMIT * 0.7 && this.weekly('storage-full'))
        this.notice('저장 공간을 70% 넘게 쓰고 있어요. 설정 → 반 전체 내보내기 뒤 복원 전 사본을 정리해 주세요.');
      else if (message) this.notice(message);
      else if (iosBrowserTab() && this.weekly('ios-home-hint'))
        this.notice('아이폰·아이패드는 공유 → 홈 화면에 추가로 설치하면 주소창 없이 화면을 꽉 채워요.');
    }
    this.game.loop.wake();
  }
  private islands() {
    this.abandon();
    this.world.showHome();
    const save = this.store.data;
    const count = STAGES.reduce((n, id) => n + save.stages[id].maps.length, 0);
    this.set(
      `<div class="page islands">${this.header('항해 지도')}<div class="page-heading"><span class="eyebrow">YOUR JOURNEY HOME</span><h1 tabindex="-1">어느 섬으로 떠날까요?</h1><p>앞선 섬을 완주하면 다음 항로가 열려요.</p><span class="map-total">${icon('map')} ${count} / ${TOTAL_MAPS} 발견 ${count === TOTAL_MAPS ? '· 지도 완성!' : ''}</span></div><div class="island-grid">${STAGES.map(
        (id, i) => {
          const c = COURSES[id],
            r = save.stages[id],
            open = unlocked(save, id);
          return `<button class="island-card ${open ? '' : 'locked'}" data-action="stage:${id}" ${open ? '' : `disabled aria-label="${c.name}, ${COURSES[STAGES[i - 1]].name} 완주 후 해금"`}><div class="island-art ${id}" style="background-image:url('${asset(id + '-mid')}'),url('${asset(id + '-far')}'),url('${asset(id + '-sky')}')">${regionArt(STAGE_VIEW[id], 'stage-illustration')}<span class="card-number">0${i + 1}</span><span class="island-badge">${r.complete ? '⚑ 완주' : open ? '탐험 가능' : '🔒 잠긴 항로'}</span></div><div class="card-copy"><span class="eyebrow">${c.subtitle}</span><h2>${c.name}</h2>${open ? `<div class="record-line"><span class="rating">${'★'.repeat(r.bestRating)}<em>${'☆'.repeat(3 - r.bestRating)}</em></span><span>지도 ${r.maps.length}/3</span></div><div class="card-bottom"><span>전체 최고 <b>${r.bestScore.toLocaleString()}</b> · 코스 3개</span><span class="round-arrow">↗</span></div>` : `<p class="unlock-hint">${COURSES[STAGES[i - 1]].name}<br>완주 후 열려요</p>`}</div></button>`;
        },
      ).join(
        '',
      )}</div><div class="page-foot"><span>${STAGES.every(id => save.stages[id].complete) ? '⚑ 전체 귀환 완료! 이타카가 영웅을 반겨요.' : '서두르지 않아도 괜찮아요. 다시 도전할 수 있으니까요.'}</span>${button('codex', '지도 도감 →', 'text-button')}</div></div>`,
      'islands',
    );
  }
  // Contests may open any island; they never record it as the last (possibly locked) stage.
  private async prepare(id: StageId, contest = false) {
    if (!contest && !unlocked(this.store.data, id)) {
      this.islands();
      return;
    }
    this.special = null;
    this.selected = id;
    this.selectedVariant = 'classic';
    if (!contest) {
      this.store.data.lastStage = id;
      this.store.persist();
    }
    this.sound.setStage(id);
    const request = ++this.loadRequest;
    this.set(
      `<div class="veil"><section class="panel"><h1 tabindex="-1">섬 준비 중</h1><p id="stage-loading">섬을 준비하고 있어요… 0%</p>${button('islands', '섬 선택', 'secondary')}</section></div>`,
      'stage-loading',
    );
    try {
      await this.world.prepare(id, n => {
        if (request === this.loadRequest) {
          const p = this.ui.querySelector('#stage-loading');
          if (p) p.textContent = `섬을 준비하고 있어요… ${Math.round(n * 100)}%`;
        }
      });
    } catch {
      if (request === this.loadRequest && this.screen === 'stage-loading')
        this.set(
          `<div class="veil"><section class="panel"><h1 tabindex="-1">섬을 준비하지 못했어요</h1><p>연결을 확인하고 다시 시도해 주세요.</p>${button('stage:' + id, '다시 준비', 'primary')}${button('islands', '섬 선택', 'secondary')}</section></div>`,
          'stage-error',
        );
      return;
    }
    if (request !== this.loadRequest || this.screen !== 'stage-loading' || this.destroyed) return;
    this.world.setStage(id);
    const c = COURSES[id];
    this.set(
      `<div class="veil"><section class="panel prepare">${button('islands', '← 항해 지도', 'text-button back')}<span class="eyebrow">${icon(STAGE_RELIC[id])} ISLAND 0${STAGES.indexOf(id) + 1} / ${c.subtitle}</span><h1 tabindex="-1">${c.name}</h1><p>${c.description}</p>${regionArt(STAGE_VIEW[id], 'prepare-art', c.name + ' 풍경')}<div class="control-guide"><div><kbd>Space / ↑</kbd><b>점프</b><span>공중에서 한 번 더!</span></div><div><kbd>↓ 꾹</kbd><b>슬라이드</b><span>낮은 문을 통과해요</span></div><div><kbd>P / Esc</kbd><b>일시정지</b><span>잠깐 쉬어 가도 돼요</span></div></div><p class="touch-hint">스마트폰에서는 화면의 점프·슬라이드 버튼을 사용해요.<br>상자·기둥·문은 닿아도 안전해요. ! 표시 위험물·몬스터와 낭떠러지를 조심하세요.</p>${this.assistLabel().length ? `<p class="assist-note">쉬운 항해 사용 중 · ${this.assistLabel().join(' · ')} · 설정에서 바꿀 수 있어요</p>` : ''}<div class="goal-line">♡ 체력 3 &nbsp; ✦ 별빛 100 &nbsp; ${icon('map')} 지도 3</div>${this.coursePicker(id)}<fieldset class="challenge-picker"><legend>이번 항해의 도전 · 하나를 골라요</legend>${Object.entries(
        GOALS,
      )
        .map(
          ([id, g]) =>
            `<label><input type="radio" name="goal" value="${id}" ${id === this.selectedGoal ? 'checked' : ''}><span><b>${g.name}</b><small>${g.description}</small></span></label>`,
        )
        .join(
          '',
        )}</fieldset><p class="route-hint">↑ 높은 유적길: 별자리·이야기 / 아래: 익숙한 항로</p>${button('start', '이 섬 달리기 <span>→</span>', 'primary large')}<small>약 75초 · 몬스터 ${c.enemies.length}마리 · 아이템 8종 · 아이템 없이도 완주 가능</small></section></div>`,
      'prepare',
    );
  }
  private coursePicker(id: StageId) {
    return `<fieldset class="course-picker"><legend>이번에 달릴 코스 · 섬마다 3개</legend>${VARIANTS.map(variant => {
      const meta = VARIANT_LABELS[id][variant],
        record = courseRecord(this.store.data, id, variant);
      return `<label><input type="radio" name="course" value="${variant}" ${variant === this.selectedVariant ? 'checked' : ''}><span><b>${meta.name}</b><small>${meta.description}</small><em>${record.complete ? '⚑ 완주' : '아직 완주 전'} · 최고 ${record.bestScore.toLocaleString()} · ${'★'.repeat(record.bestRating)}${'☆'.repeat(3 - record.bestRating)}</em></span></label>`;
    }).join(
      '',
    )}<p>모든 코스는 약 75초 · 별빛 100 · 지도 3<br>어느 코스든 완주하면 다음 섬이 열려요. 지도와 발견은 함께 모아요.</p></fieldset>`;
  }
  private start() {
    if (this.special !== 'contest' && !unlocked(this.store.data, this.selected)) {
      this.islands();
      return;
    }
    this.abandon();
    this.sound.setStage(this.selected, true);
    this.result = null;
    this.run = new Runner(
      this.selected,
      this.selectedGoal,
      this.selectedVariant,
      this.special === 'boss'
        ? BOSS_COURSES[this.selected]
        : this.special === 'endless' && this.endless
          ? this.endless.course
          : undefined,
      this.special === 'daily' && this.daily?.rule === 'no-shield' ? 'no-shield' : 'none',
    );
    this.run.autoSlide = this.assist().autoSlide;
    this.world.showRun(this.run);
    this.store.data.tutorialSeen = true;
    this.store.persist();
    this.beginCountdown();
  }
  private assist(): Assist {
    if (this.special === 'contest' && !this.contest?.assist) return defaultPreferences().assist;
    return this.store.data.preferences.assist;
  }
  private assistLabel() {
    const a = this.assist();
    return [
      a.pace < 1 ? `속도 ${a.pace}배` : '',
      a.slideToggle ? '슬라이드 토글' : '',
      a.autoSlide ? '버튼 하나' : '',
    ].filter(Boolean);
  }
  private hud() {
    return `<div class="play-ui" tabindex="-1" role="group" aria-label="게임 조작" data-one-button="${this.assist().autoSlide}"><div class="hud"><div class="hp-block"><span class="hud-caption">오디세우스</span><strong id="hp" role="img" aria-label="체력 3"></strong></div><div class="route-progress"><span>${this.special === 'boss' ? BOSSES[this.selected].name : this.special === 'daily' ? '오늘의 항해 · ' + this.daily!.name : this.special === 'contest' ? '대회 · ' + esc(this.contest!.title) : this.special === 'endless' ? '끝없는 항해 · ' + COURSES[this.selected].name : COURSES[this.selected].name + ' · ' + VARIANT_LABELS[this.selected][this.selectedVariant].name}</span><progress id="progress" data-course="${this.selected}/${this.selectedVariant}" max="24000" value="0" aria-label="섬 진행률"></progress><i id="ghost-marker" hidden aria-label="비교 항해 위치"></i><small id="progress-label">0%</small></div><div class="score-block"><span class="hud-caption">SCORE</span><strong id="score">0</strong></div><div class="hud-actions">${button('fullscreen', '⛶', 'fullscreen-button', 'aria-label="전체 화면 전환"')}${button('pause', 'Ⅱ', 'pause-button', 'aria-label="일시정지"')}</div></div><div class="run-chips"><div class="run-details"><span id="stars">✦ 0 / 100</span><span id="maps">지도 0 / 3</span><span id="effects"></span>${this.assistLabel().length ? `<span class="assist-chip">쉬운 항해 · ${this.assistLabel().join(' · ')}</span>` : ''}</div><div class="adventure-hud"><span id="goal-progress"></span><span id="ghost-delta"></span><span id="discovery-progress"></span></div></div><div class="touch-controls"><button data-control="slide" class="control slide" aria-label="슬라이드, 누르고 유지"><span>⇣</span><b>슬라이드</b><small>↓ 누르기</small></button><button data-control="jump" class="control jump" aria-label="점프, 공중에서 다시 누르면 2단 점프"><span>↟</span><b>점프</b><small>Space / ↑</small></button></div></div>`;
  }
  private beginCountdown() {
    this.countdown = 3;
    this.accumulator = 0;
    this.sound.setPlaying(false);
    this.run!.state = 'ready';
    this.set(
      this.hud() +
        `<div class="countdown" role="status" aria-live="polite"><span>준비됐나요?</span><strong id="count">3</strong><small>점프 · 2단 점프 · 슬라이드</small>${button('pause', '잠시 멈추기', 'secondary')}</div>`,
      'countdown',
    );
    this.controls.bind(this.ui);
    this.updateHud();
  }
  private play() {
    this.countdown = 0;
    this.run!.state = 'playing';
    this.set(this.hud(), 'play');
    this.controls.bind(this.ui);
    this.sound.setPlaying(true);
    this.updateHud();
  }
  private pause() {
    if (!this.run || !['play', 'countdown'].includes(this.screen)) return;
    this.run.state = 'paused';
    this.accumulator = 0;
    this.sound.setPlaying(false);
    this.controls.clear();
    this.run.clearInput();
    this.set(
      this.hud() +
        `<div class="veil"><section class="panel pause-panel"><span class="eyebrow">TAKE A BREATH</span><h1 tabindex="-1">잠깐, 쉬어 가요</h1><p>이타카는 기다려 줄 거예요.</p>${button('resume', '계속 달리기 →', 'primary large')}<div class="button-row">${button('restart', '다시 시작', 'secondary')}${button('islands', '섬 선택', 'secondary')}</div>${button('touch-layout', '터치 버튼 맞춤', 'secondary')}${button('quit', '게임 종료', 'text-button')}<div class="pause-sound">${settingToggle(this.store.data, 'music', '배경음')}${settingToggle(this.store.data, 'sfx', '효과음')}</div></section></div>`,
      'pause',
    );
    this.updateHud();
  }
  private suspend() {
    if (['play', 'countdown'].includes(this.screen)) this.pause();
    this.controls.clear();
    this.sound.setPlaying(false);
  }
  private abandon() {
    this.loadRequest++;
    if (this.run) {
      this.run.clearInput();
      this.run.state = 'paused';
    }
    this.run = null;
    this.accumulator = 0;
    this.controls.clear();
    this.sound.setPlaying(false);
  }
  private finish() {
    if (!this.run || this.result) return;
    this.result = this.run.result();
    if (this.special) {
      this.finishSpecial();
      return;
    }
    this.store.data = mergeResult(this.store.data, this.result);
    this.store.persist();
    this.protect();
    this.sound.setPlaying(false);
    this.controls.clear();
    const r = this.result,
      record = this.store.data.stages[r.stage],
      routeRecord = courseRecord(this.store.data, r.stage, r.variant ?? 'classic'),
      last = r.stage === STAGES.at(-1),
      next = STAGES[STAGES.indexOf(r.stage) + 1];
    this.set(
      `<div class="veil result-veil"><section class="panel result"><span class="eyebrow">${r.complete ? icon('laurel') : ''} ${r.complete ? 'ISLAND COMPLETE' : 'THE JOURNEY CONTINUES'}</span><h1 tabindex="-1">${r.complete ? (last ? '마침내, 이타카!' : '멋진 항해였어요!') : r.stage === 'cave' ? '거인에게 잡혔어요!' : '다시, 한 걸음 더!'}</h1><p>${r.complete ? (last ? '오디세우스가 고향 항구에 도착했어요. 긴 모험을 함께해 줘서 고마워요.' : COURSES[r.stage].name + ' 완주! 다음 섬의 항로가 열렸어요.') : '괜찮아요. 익숙해질수록 더 멀리 갈 수 있어요.'}</p>${last && r.complete ? regionArt('view-ithaca', 'ending-art', '이타카 도착 항구') : ''}<p class="course-result-label">${VARIANT_LABELS[r.stage][r.variant ?? 'classic'].name}</p><div class="mission-badge">${r.adventure?.stamps.length ? '✓ 도전 도장 · ' + GOALS[this.selectedGoal].name : '◇ 다음 항해에서 도전에 다시 도전해요'}</div><div class="result-stars" aria-label="이번 평점 ${r.rating}점">${'★'.repeat(r.rating)}<em>${'☆'.repeat(3 - r.rating)}</em></div><div class="result-score"><span>이번 항해 점수</span><strong>${r.score.toLocaleString()}</strong><small>코스 최고 ${routeRecord.bestScore.toLocaleString()} ${r.score === routeRecord.bestScore ? '· NEW BEST' : ''}<br>섬 전체 최고 ${record.bestScore.toLocaleString()}</small></div>${this.rivalLine(r)}<div class="score-breakdown"><div><span>최고 전진거리</span><b>${Math.floor(r.distance / 10)}</b></div><div><span>별빛 ${r.stars} × 10</span><b>${r.stars * 10}</b></div><div><span>지도 ${r.maps.length} × 100</span><b>${r.maps.length * 100}</b></div><div><span>완주 보너스</span><b>${r.complete ? 500 : 0}</b></div></div><div class="result-summary"><span>♡ HP 손실 ${r.hpLoss}회</span><span>${icon('map')} 영구 지도 ${record.maps.length}/3</span></div>${this.damageSummary()}<small class="rating-help">완주 ★ · 별빛 70개 이상 ★ · HP 손실 0회 ★</small><div class="result-actions">${button('restart', '재도전', 'secondary')}${button('stage:' + r.stage, '다른 코스 고르기', 'secondary')}${r.complete && next ? button('stage:' + next, '다음 섬으로 →', 'primary') : button('islands', '섬 선택 →', 'primary')}</div>${r.complete && next ? button('islands', '섬 선택', 'text-button') : ''}${last && r.complete ? button('codex', '귀환의 지도 보기', 'text-button') : ''}<div class="adventure-result"><b>${r.adventure?.stamps.length ? '✓ 도전 성공! ' + GOALS[this.selectedGoal].name : '이번 도전: ' + GOALS[this.selectedGoal].name}</b><p>아슬아슬 회피 ${r.adventure?.nearMisses || 0} · 몬스터 회피 ${r.adventure?.evaded || 0} · 유도 격파 ${r.adventure?.tricked || 0}<br>별자리 ${r.adventure?.constellations.length || 0} · 이야기 ${r.adventure?.stories.length || 0} · 조합 ${r.adventure?.combos.length || 0}</p>${r.adventure ? button('share', '기록 공유 · QR', 'text-button') : ''}${button('quiz', '신화 퀴즈 한 문제', 'text-button')}${button('journal', '모험 수첩', 'text-button')}${button('harbor', '달라진 항구 보기', 'text-button')}${button('quit', '게임 종료', 'text-button')}</div></section></div>`,
      'result',
    );
  }
  private rivalLine(r: RunResult) {
    const rival = this.rivalFor(r.stage, r.variant ?? 'classic');
    if (!rival) return '';
    const diff = r.score - rival.score;
    return `<p class="rival-result"><b>친구 ‘${esc(rival.name)}’ ${rival.score.toLocaleString()}점</b> · ${diff > 0 ? `${diff.toLocaleString()}점 앞섰어요!` : diff === 0 ? '똑같은 점수예요!' : `${(-diff).toLocaleString()}점 차이, 다시 도전해 봐요`}</p>`;
  }
  private wardrobe() {
    this.abandon();
    this.world.showHome();
    this.set(
      `<div class="page wardrobe">${this.header('영웅의 옷장')}<div class="page-heading"><span class="eyebrow">EARNED ON YOUR JOURNEY</span><h1 tabindex="-1">모험의 색을 입어요</h1><p>성과를 달성하면 자동으로 열려요. 점수는 소비하지 않고 능력치도 바뀌지 않아요.</p></div><div class="trial-grid">${(
        ['cape', 'emblem', 'sail'] as const
      )
        .map(
          slot =>
            `<section class="trial-card"><h2>${slot === 'cape' ? '망토' : slot === 'emblem' ? '영웅의 문양' : '항구의 돛'}</h2>${COSMETICS.filter(
              c => c.slot === slot,
            )
              .map(c => {
                const open = cosmeticUnlocked(this.store.data, c.id),
                  selected = this.store.data.preferences[slot] === c.id;
                return `<button data-action="equip:${slot}:${c.id}" class="cosmetic-choice ${selected ? 'equipped' : ''}" aria-pressed="${selected}" ${open ? '' : 'disabled'}><span class="cosmetic-swatch" aria-hidden="true" style="background:${c.color}">${slot === 'emblem' ? (c.id === 'owl' ? '◉◉' : c.id === 'star' ? '☆' : '◇') : slot === 'sail' ? '◩' : '♜'}</span><span>${c.name}<small>${selected ? '✓ 사용 중' : open ? '선택할 수 있어요' : c.requirement}</small></span></button>`;
              })
              .join('')}</section>`,
        )
        .join('')}</div></div>`,
      'wardrobe',
    );
  }
  private challenges() {
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
      )}</div>${this.endlessCards()}${this.dailyCard()}<section class="daily-card"><span class="eyebrow">FOR TEACHERS</span><h2>교사용 대회</h2><p>코스를 정해 QR로 학생을 초대하고, 결과 QR을 찍어 순위를 모아요.</p>${button('contests', '대회 열기·순위 보기', 'secondary')}</section></div>`,
      'challenges',
    );
  }
  private async prepareBoss(id: StageId) {
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
  }
  private dailyCard() {
    const d = dailySpec(),
      r = this.store.data.expeditions.daily.find(r => r.date === d.date);
    return `<section class="daily-card"><span class="eyebrow">TODAY’S VOYAGE · ${d.date} 한국 날짜</span><h2>${d.name}</h2><p>${d.description}</p><p>출항의 해변 · ${VARIANT_LABELS.beach[d.variant].name} · 약 75초</p><p>${r ? `최고 ${r.bestScore}점 · ${r.complete ? '✓ 오늘 도전 성공' : '다시 도전할 수 있어요'}` : '오늘의 첫 항해를 시작해 보세요.'}</p>${button('daily', '오늘의 항해 시작', 'primary')}<small>기기 시각을 사용해요. 최근 14일을 보관하며 온라인 순위는 제공하지 않아요.</small></section>`;
  }
  private async prepareDaily() {
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
  }
  private finishSpecial() {
    if (this.special === 'contest') {
      this.finishContest();
      return;
    }
    if (this.special === 'endless') {
      this.finishEndless();
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
    this.store.persist();
    this.set(
      `<div class="veil"><section class="panel result special-result"><span class="eyebrow">${boss ? 'BOSS ENCOUNTER' : 'TODAY’S VOYAGE · ' + this.daily!.date}</span><h1 tabindex="-1">${passed ? (boss ? '보스의 패턴을 돌파했어요!' : '오늘의 항해 성공!') : r.complete ? '완주했어요! 다음엔 조건도 달성해 봐요' : '다시, 패턴을 읽어 봐요'}</h1><p>${boss ? BOSSES[r.stage].name : this.daily!.name}</p><div class="result-score"><strong>${r.score}</strong><small>이 도전의 최고 ${best}점</small></div><p>HP 손실 ${r.hpLoss}회 · 별빛 ${r.stars}개 · ${Math.floor(r.distance / 10)}m / ${this.run!.length / 10}m</p>${!boss && !passed ? `<p>${this.daily!.description}</p>` : ''}${this.damageSummary()}<p>일반 최고 기록·지도·섬 해금에는 반영하지 않아요.</p><div class="button-row">${button('restart', '재도전', 'primary')}${button('challenges', '특별 항해', 'secondary')}${button('home', '시작 화면', 'secondary')}</div>${button('quiz', '신화 퀴즈 한 문제', 'text-button')}</section></div>`,
      'result',
    );
  }
  private damageSummary() {
    const events = this.run?.damageLog ?? [];
    if (!events.length) return '';
    const last = damageGuidance(events.at(-1)!);
    return `<section class="damage-summary"><h2>다음 항해의 힌트</h2><p>마지막 HP 손실: <b>${last.name}</b> · ${last.meters}m 지점</p><p>${last.hint}</p><small>방패 방어는 HP 손실에 포함하지 않아요. 회복해도 피해 이력은 남아요.</small></section>`;
  }
  private codex() {
    const found = new Set(STAGES.flatMap(id => this.store.data.stages[id].maps));
    this.set(codexPage(this.header('귀환의 지도'), found), 'codex');
  }
  private landscapes() {
    this.set(landscapesPage(this.header('항해 도감')), 'landscapes');
  }
  private sheet(id: string) {
    const html = sheetPage(this.header('풍경과 원화', 'landscapes'), id);
    if (html) this.set(html, 'sheet');
  }
  private people() {
    this.set(peoplePage(this.header('항해 도감')), 'people');
  }
  private person(id: string) {
    const html = personPage(id);
    if (html) this.set(html, 'person');
  }
  private relics() {
    this.set(relicsPage(this.header('항해 도감')), 'relics');
  }
  private bestiary() {
    this.set(bestiaryPage(this.header('항해 도감')), 'bestiary');
  }
  private journal() {
    this.abandon();
    this.world.showHome();
    const j = this.store.data.journal;
    this.set(
      `<div class="page journal">${this.header('모험 수첩')}<div class="page-heading"><span class="eyebrow">YOUR OWN ODYSSEY</span><h1 tabindex="-1">나만의 모험을 채워요</h1><p>도전 도장과 발견은 결과 화면에서 기록돼요. 점수와 별빛을 소비하지 않아요.</p></div>${bookNav('journal')}${journalCards(j)}<section class="journal-section"><h2>다시 달릴 항로</h2><p>${STAGES.map(id => `${COURSES[id].name}: ${j.routes.includes(id + '-upper') ? '✓ 높은 길' : '○ 높은 길'} · ${j.routes.includes(id + '-lower') ? '✓ 아래 길' : '○ 아래 길'}`).join('<br>')}</p></section><section class="journal-section"><h2>신화 퀴즈</h2><p>맞힌 문제 ${this.store.data.quiz.length} / ${QUIZ.length}</p>${button('quiz', '한 문제 풀기', 'secondary')}</section><div class="page-foot">${button('islands', '다음 모험으로 →', 'primary')}</div></div>`,
      'journal',
    );
  }
  private harbor() {
    this.abandon();
    this.world.showHome();
    const save = this.store.data,
      done = STAGES.filter(id => save.stages[id].complete).length,
      maps = STAGES.reduce((n, id) => n + save.stages[id].maps.length, 0),
      unlocks = harborUnlocks(save.journal, done, maps);
    this.set(
      `<div class="page harbor">${this.header('이타카 항구')}<div class="page-heading"><span class="eyebrow">A HOME WORTH RETURNING TO</span><h1 tabindex="-1">모험이 쌓이는 우리 항구</h1><p>배·등대·동료의 집·별빛 깃발·축제를 하나씩 완성해요. ${unlocks.filter(Boolean).length}/5 완성</p></div><div class="harbor-picture">${harborArt(unlocks, save.preferences.sail)}</div><div class="harbor-checklist">${harborRequirements.map((text, i) => `<span class="${unlocks[i] ? 'complete' : ''}">${unlocks[i] ? '✓' : '○'} ${text}</span>`).join('')}</div><div class="page-foot">${button('islands', '항구를 위한 모험 →', 'primary')}${button('journal', '모험 수첩', 'secondary')}</div></div>`,
      'harbor',
    );
  }
  private discovery(id: string) {
    const story = Object.values(ADVENTURE_PLANS)
      .flatMap(p => p.stories)
      .find(s => s.id === id);
    if (!story || !this.store.data.journal.stories.includes(id)) return;
    this.set(
      `<div class="veil"><section class="panel story"><span class="eyebrow">HIDDEN WORDS</span><h1 tabindex="-1">${story.title}</h1><p>${story.story}</p>${button('journal', '모험 수첩으로', 'primary')}</section></div>`,
      'discovery',
    );
  }
  private profilesPage(message = '') {
    this.abandon();
    this.world.showHome();
    const board = this.profiles.board(),
      active = this.profiles.active.id;
    this.set(
      `<div class="page profiles">${this.header('항해사')}<div class="page-heading"><span class="eyebrow">ONE DEVICE, MANY SAILORS</span><h1 tabindex="-1">누가 항해할까요?</h1><p>항해사마다 기록·설정·옷장을 따로 저장해요. 이 기기 안에서만 보여요.</p></div><section class="profile-form"><label>항해사 이름 <input id="profile-name" maxlength="${MAX_NAME}" autocomplete="off" placeholder="예: 지우"></label><div class="button-row">${button('profile-add', '새 항해사로 시작', 'primary')}${button('profile-rename', '지금 항해사 이름 바꾸기', 'secondary')}</div><details class="numbered"><summary>번호로 한 번에 만들기</summary><div class="numbered-body"><label>만들 항해사 수 <input id="profile-count" type="number" inputmode="numeric" min="1" max="${MAX_PROFILES}" value="${Math.min(30, MAX_PROFILES - this.profiles.book.list.length) || 1}"></label>${button('profile-numbered', '만들기', 'secondary')}<small>1번, 2번…처럼 번호 이름을 만들어요. 학생은 자기 번호를 골라 시작해요. 최대 ${MAX_PROFILES}명.</small></div></details><p role="status" id="profile-message">${esc(message)}</p></section><section class="class-board"><h2>우리 반 항해 순위 <small>이 기기에 저장된 기록</small></h2><ol>${board.map((p, i) => `<li class="${p.id === active ? 'active' : ''}"><span class="rank">${i + 1}</span><b translate="no">${esc(p.name)}</b><span>${p.total.toLocaleString()}점</span><span>완주 ${p.islands}/${STAGES.length}</span><span>지도 ${p.maps}</span><span>퀴즈 ${p.quiz}</span>${p.id === active ? '<em>✓ 항해 중</em>' : button('profile-use:' + p.id, '이 항해사로', 'secondary')}${p.id === active || p.id === MAIN_PROFILE ? '' : button('profile-delete:' + p.id, '지우기', 'text-button danger', `aria-label="‘${esc(p.name)}’ 지우기"`)}</li>`).join('')}</ol><small>점수는 섬별 최고 점수의 합이에요. 온라인으로 보내지 않아요.</small>${button('progress', '📋 학생별 진행 현황', 'secondary')}</section></div>`,
      'profiles',
    );
  }
  private switchProfile(id: string, message: string) {
    if (!this.profiles.use(id)) {
      this.profilesPage('항해사를 바꾸지 못했어요. 브라우저 저장 권한을 확인해 주세요.');
      return;
    }
    this.abandon();
    this.store = new SaveStore(this.storage, profileKey(id));
    this.selected = this.store.data.lastStage;
    this.selectedVariant = 'classic';
    this.question = null;
    this.resizeDisplay();
    this.sound.changed();
    this.profilesPage(message);
  }
  private profileAction(kind: string, id = '') {
    const input = this.ui.querySelector<HTMLInputElement>('#profile-name'),
      name = input?.value ?? '';
    try {
      if (kind === 'add') {
        const created = this.profiles.add(name);
        this.switchProfile(created, `새 항해사 ‘${this.profiles.active.name}’의 기록을 시작해요.`);
      } else if (kind === 'numbered') {
        const want = Number(this.ui.querySelector<HTMLInputElement>('#profile-count')?.value) || 0,
          made = this.profiles.addNumbered(Math.max(0, Math.min(MAX_PROFILES, Math.floor(want))), n =>
            translate(`${n}번`),
          );
        this.profilesPage(
          made ? `번호 항해사 ${made}명을 만들었어요.` : `더 만들 수 없어요. 항해사는 ${MAX_PROFILES}명까지예요.`,
        );
      } else if (kind === 'rename') {
        this.profiles.rename(this.profiles.active.id, name);
        this.profilesPage('이름을 바꿨어요.');
      } else if (kind === 'use') {
        const p = this.profiles.book.list.find(p => p.id === id);
        if (p) this.switchProfile(id, `지금 항해사: ${p.name}`);
      } else if (kind === 'delete') {
        const p = this.profiles.book.list.find(p => p.id === id);
        if (!p || id === MAIN_PROFILE || id === this.profiles.active.id) return;
        this.pendingDelete = id;
        this.set(
          `<div class="veil"><section class="panel"><h1 tabindex="-1">‘${esc(p.name)}’ 항해사를 지울까요?</h1><p>이 항해사의 기록·설정·백업을 이 기기에서 지워요. 되돌릴 수 없어요.</p><div class="button-row">${button('profiles', '취소', 'secondary')}${button('profile-delete-confirm', '지우기', 'danger-button')}</div></section></div>`,
          'profile-delete',
        );
      } else if (kind === 'delete-confirm' && this.screen === 'profile-delete' && this.pendingDelete) {
        this.profiles.remove(this.pendingDelete);
        this.pendingDelete = '';
        this.profilesPage('항해사를 지웠어요.');
      }
    } catch (error) {
      const box = this.ui.querySelector('#profile-message');
      if (box) box.textContent = (error as Error).message;
      else this.profilesPage((error as Error).message);
    }
  }
  private quiz() {
    if (this.screen !== 'quiz' && this.screen !== 'quiz-answer')
      this.quizReturn = ['people', 'journal'].includes(this.screen) ? this.screen : 'islands';
    this.abandon();
    const done = this.store.data.quiz,
      open = QUIZ.filter(q => !done.includes(q.id) && q.id !== this.question?.id),
      pool = open.length ? open : QUIZ.filter(q => q.id !== this.question?.id);
    this.question = pool[Math.floor(Math.random() * pool.length)];
    const q = this.question;
    this.set(
      `<div class="veil"><section class="panel quiz-panel"><span class="eyebrow">MYTH QUIZ · 맞힌 문제 ${done.length}/${QUIZ.length}</span><h1 tabindex="-1">${q.question}</h1><div class="quiz-options">${q.options.map((o, i) => button('quiz-answer:' + i, `<b>${'ABC'[i]}</b> ${o}`, 'secondary')).join('')}</div>${button(this.quizReturn, '그만 풀기', 'text-button')}<small>점수·해금과 상관없이 언제든 풀 수 있어요.</small></section></div>`,
      'quiz',
    );
  }
  private quizAnswer(choice: number) {
    const q = this.question;
    if (!q || this.screen !== 'quiz') return;
    const right = choice === q.answer;
    if (right && !this.store.data.quiz.includes(q.id)) {
      this.store.data.quiz.push(q.id);
      this.store.persist();
    }
    this.set(
      `<div class="veil"><section class="panel quiz-panel" data-correct="${right}"><span class="eyebrow">MYTH QUIZ · 맞힌 문제 ${this.store.data.quiz.length}/${QUIZ.length}</span><h1 tabindex="-1">${right ? '정답이에요!' : '아쉬워요, 다음엔 맞힐 수 있어요'}</h1><p><b>정답: ${q.options[q.answer]}</b></p><p>${q.explain}</p><div class="button-row">${button('quiz', '한 문제 더', 'primary')}${button(this.quizReturn, '돌아가기', 'secondary')}</div></section></div>`,
      'quiz-answer',
    );
  }
  private quit() {
    const unfinished = !!this.run && !this.result;
    this.abandon();
    this.world.showHome();
    this.set(
      `<div class="veil"><section class="panel quit-panel"><span class="eyebrow">UNTIL OUR NEXT VOYAGE</span><h1 tabindex="-1">오늘의 항해를 마쳤어요</h1><p>게임과 소리는 멈췄어요.<br>확정된 기록과 설정은 그대로 보관해요.${unfinished ? '<br>진행 중이던 판의 임시 점수와 발견은 반영하지 않아요.' : ''}</p><div class="button-row">${button('home', '시작 화면으로', 'primary')}${button('close-tab', '탭 닫기', 'secondary')}</div><small>탭 닫기가 지원되지 않으면 브라우저의 닫기 버튼을 사용해 주세요.</small></section></div>`,
      'quit',
    );
  }
  private story(index: number) {
    const id = `${STAGES[Math.floor(index / 3)]}-map-${(index % 3) + 1}`;
    if (!STAGES.some(s => this.store.data.stages[s].maps.includes(id))) return;
    const [title, text] = MAP_STORIES[index];
    this.set(
      `<div class="veil"><section class="panel story">${icon('map')}<span class="eyebrow">FRAGMENT 0${index + 1}</span><h1 tabindex="-1">${title}</h1><p>${text}</p>${button('codex', '도감으로 돌아가기', 'primary')}</section></div>`,
      'story',
    );
  }
  // True at most once a week per hint, so tips do not repeat every visit.
  private weekly(name: string) {
    try {
      const key = SAVE_KEY + ':' + name,
        last = Number(this.storage?.getItem(key) ?? 0);
      if (Date.now() - last < 7 * 86_400_000) return false;
      this.storage?.setItem(key, String(Date.now()));
    } catch {}
    return true;
  }
  private protect() {
    if (this.protectionAsked || this.protectionState === 'persisted') return;
    this.protectionAsked = true;
    void requestProtection().then(p => (this.protectionState = p));
  }
  private protectionLine() {
    const age = backupAge(this.storage),
      last = age === null ? '아직 없음' : age === 0 ? '오늘' : `${age}일 전`;
    return [
      `마지막 반 전체 백업: ${last}`,
      this.protectionState === 'persisted'
        ? '이 브라우저는 기록을 지우지 않도록 보호하고 있어요.'
        : '저장 공간이 부족하거나 오래 열지 않으면 브라우저가 기록을 지울 수 있어요.',
      iosBrowserTab() ? '아이폰·아이패드는 공유 → 홈 화면에 추가로 설치해야 오래 열지 않아도 기록이 남아요.' : '',
      `저장 공간 ${Math.ceil(storageUse(this.storage) / 1024).toLocaleString()}KB 사용 (한도 약 ${STORAGE_LIMIT / 1048576}MB의 ${Math.round((storageUse(this.storage) / STORAGE_LIMIT) * 100)}%)`,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  private settings() {
    // Sub-pages of settings (touch layout, offline, import, reset) keep the original way back.
    if (!['settings', 'touch-layout', 'offline', 'import', 'reset', 'class-import'].includes(this.screen))
      this.returnScreen = this.screen === 'islands' ? 'islands' : 'home';
    this.set(
      settingsMarkup({
        header: this.header('설정', this.returnScreen),
        save: this.store.data,
        assist: this.assist(),
        blocked: this.store.blocked,
        protection: this.protectionLine(),
        canAskProtection: this.protectionState === 'best-effort',
        spare: spareCopies(this.storage).length,
        backedUpToday: backupAge(this.storage) === 0,
        deviceMotion: deviceReducedMotion(),
      }),
      'settings',
    );
  }
  private applyLayout() {
    const t = this.store.data.preferences.touch,
      root = document.querySelector<HTMLElement>('#shell')!;
    root.style.setProperty('--control-size', t.size + 'px');
    root.style.setProperty('--control-bottom', t.bottom + 'px');
    root.style.setProperty('--control-inset', t.inset + '%');
    root.style.setProperty('--control-opacity', String(t.opacity));
    root.dataset.swapped = String(t.swapped);
  }
  private touchLayout() {
    const t = this.store.data.preferences.touch;
    this.set(
      `<div class="veil"><section class="panel layout-editor"><h1 tabindex="-1">터치 버튼 맞춤</h1><p>멈춘 상태에서 조절해요. 미리보기 버튼은 점프를 실행하지 않아요.</p>${(
        [
          ['size', '버튼 크기', 64, 112, 1, 'px'],
          ['bottom', '아래에서 올리기', 0, 60, 1, 'px'],
          ['inset', '가장자리에서 안쪽으로', 0, 20, 1, '%'],
          ['opacity', '버튼 불투명도', 0.4, 1, 0.05, ''],
        ] as const
      )
        .map(
          ([key, label, min, max, step, unit]) =>
            `<label class="layout-range">${label} <output data-output="${key}">${t[key]}${unit}</output><input type="range" data-layout="${key}" min="${min}" max="${max}" step="${step}" value="${t[key]}"></label>`,
        )
        .join(
          '',
        )}<label class="layout-range"><input type="checkbox" data-layout="swapped" ${t.swapped ? 'checked' : ''}> 점프와 슬라이드 좌우 바꾸기</label><div class="layout-preview" aria-label="버튼 배치 미리보기"><span class="preview-slide">⇣ 숙이기</span><span class="preview-jump">↟ 점프</span></div><div class="button-row">${button('layout-reset', '기본 배치', 'secondary')}${button('layout-save', '저장하고 돌아가기', 'primary')}</div></section></div>`,
      'touch-layout',
    );
  }
  private layoutInput(e: Event) {
    const input = e.target as HTMLInputElement,
      key = input.dataset.layout;
    if (this.screen !== 'touch-layout' || !key) return;
    const t = this.store.data.preferences.touch;
    if (key === 'swapped') t.swapped = input.checked;
    else if (['size', 'bottom', 'inset', 'opacity'].includes(key)) {
      const k = key as 'size' | 'bottom' | 'inset' | 'opacity';
      t[k] = Number(input.value);
      const out = this.ui.querySelector(`[data-output="${key}"]`);
      if (out) out.textContent = input.value + (key === 'opacity' ? '' : key === 'inset' ? '%' : 'px');
    }
    this.applyLayout();
  }
  private closeLayout() {
    if (this.controlsReturn && this.run) {
      this.screen = 'play';
      this.pause();
    } else this.settings();
  }
  private offlineKey() {
    const o = this.offline;
    return JSON.stringify([o.available, o.downloading, o.ready, o.bytes, o.waiting, o.message, navigator.onLine]);
  }
  private lastOffline = '';
  // Progress ticks only rewrite the busy button; other changes re-render but keep keyboard focus.
  private offlineChanged() {
    const o = this.offline,
      key = this.offlineKey();
    if (key === this.lastOffline && o.downloading) {
      const b = this.ui.querySelector(`[data-action="download-stage:${o.downloading}"]`);
      if (b) b.textContent = translate(`다운로드 중 ${Math.floor(o.progress * 100)}%`);
      return;
    }
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.action;
    this.offlinePage();
    if (focused)
      queueMicrotask(() =>
        this.ui.querySelector<HTMLElement>(`[data-action="${focused}"]`)?.focus({preventScroll: true}),
      );
  }
  private offlinePage() {
    this.lastOffline = this.offlineKey();
    const o = this.offline;
    this.set(
      `<div class="page offline-page">${this.header('오프라인과 업데이트', 'settings')}<div class="page-heading"><h1 tabindex="-1">섬을 기기에 담아요</h1><p>${navigator.onLine ? '온라인 연결 상태' : '오프라인 상태'} · ${o.available ? '다운로드 준비됨' : '오프라인 기능 준비 중'}</p><p>이미 내려받은 파일을 검사해 완료 여부를 표시해요. 브라우저가 저장 공간을 비우면 다시 내려받아야 해요.</p></div><div class="trial-grid stages">${STAGES.map(id => `<section class="trial-card"><h2>${COURSES[id].name}</h2><p>${o.ready[id] ? '✓ 오프라인 이용 가능' : '아직 다운로드 전'}</p><small>공통 파일 재사용 · 음악 포함 · ${o.bytes[id] === undefined ? '크기 확인 중' : '약 ' + Math.ceil(o.bytes[id]! / 1048576) + 'MB'}</small>${button('download-stage:' + id, o.downloading === id ? `다운로드 중 ${Math.floor(o.progress * 100)}%` : o.ready[id] ? '파일 다시 확인·받기' : '섬 다운로드', 'primary', !o.available || o.downloading || !navigator.onLine ? 'disabled' : '')}</section>`).join('')}</div><section class="daily-card"><h2>새 버전</h2><p>${o.waiting ? '새 버전이 준비됐어요. 적용하면 화면을 다시 열어요.' : '현재 버전으로 플레이 중이에요.'}</p><p class="muted" translate="no">${o.version ? 'build ' + esc(o.version) : ''}</p>${button('update', o.waiting ? '업데이트 적용' : '새 버전 확인', 'secondary', o.downloading ? 'disabled' : '')}${button('offline-refresh', '파일 상태 다시 확인', 'secondary')}<p role="status">${o.message}</p><small>기록은 유지해요. 다른 탭의 항해가 끝나야 업데이트할 수 있어요.</small></section></div>`,
      'offline',
    );
  }
  private download(data: string | Blob, filename: string, type = 'application/json;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([data], {type}));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private export() {
    this.download(
      JSON.stringify(this.store.data, null, 2),
      `odyssey-run-save-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`,
    );
  }
  private async change(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.matches('[data-lang]')) {
      if (['play', 'countdown', 'pause'].includes(this.screen) || !LANGS.some(l => l.id === input.value)) return;
      setLang(input.value as Lang, this.storage);
      location.reload();
      return;
    }
    if (input.id === 'quality') {
      this.store.data.preferences.quality = input.value as Quality;
      this.store.persist();
      // Choosing "auto" again gives this device a fresh chance at the sharper renderer.
      if (input.value === 'auto')
        try {
          this.storage?.removeItem(SLOW_KEY);
          this.frameWatch = new FrameWatch();
        } catch {}
      this.resizeDisplay();
      this.notice();
      return;
    }
    if (input.name === 'course' && isVariant(input.value) && this.screen === 'prepare') {
      this.selectedVariant = input.value;
      return;
    }
    if (input.name === 'goal' && Object.hasOwn(GOALS, input.value)) {
      this.selectedGoal = input.value as GoalId;
      return;
    }
    if (input.hasAttribute('data-autofs')) {
      this.store.data.preferences.autoFullscreen = input.checked;
      this.store.persist();
      return;
    }
    if (input.hasAttribute('data-haptics')) {
      this.store.data.preferences.haptics = input.checked;
      this.store.persist();
      vibrate('block', input.checked);
      return;
    }
    if (input.dataset.assist) {
      const a = this.store.data.preferences.assist,
        key = input.dataset.assist;
      if (key === 'pace' && PACES.includes(Number(input.value) as Pace)) a.pace = Number(input.value) as Pace;
      if (key === 'slideToggle' || key === 'autoSlide') a[key] = input.checked;
      this.store.persist();
      this.notice();
      return;
    }
    if (input.dataset.setting) {
      this.store.data.settings[input.dataset.setting as keyof Settings] = input.checked;
      this.store.persist();
      this.sound.unlock();
      this.sound.changed();
      this.notice();
      return;
    }
    if (input.id === 'class-import' && input.files?.[0]) void this.readClassFile(input, input.files[0]);
    else if (input.id === 'import-file' && input.files?.[0]) void this.readSaveFile(input, input.files[0]);
  }
  private async readClassFile(input: HTMLInputElement, file: File) {
    const box = this.ui.querySelector('#import-error');
    try {
      if (file.size > CLASS_BACKUP_LIMIT) throw Error('반 전체 백업 파일은 4MB 이하여야 해요.');
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw Error('JSON 파일을 읽을 수 없어요. 올바른 기록 파일을 선택해 주세요.');
      }
      if (this.screen !== 'settings') return;
      this.classImport = readClassBackup(raw);
      this.classPreview();
    } catch (error) {
      if (box) box.textContent = (error as Error).message;
    } finally {
      input.value = '';
    }
  }
  private async readSaveFile(input: HTMLInputElement, file: File) {
    const request = ++this.importRequest;
    const active = () =>
      !this.destroyed && request === this.importRequest && this.screen === 'settings' && input.isConnected;
    try {
      if (file.size > 65536) throw Error('기록 파일은 64KiB 이하여야 해요.');
      const text = await file.text();
      if (!active()) return;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw Error('JSON 파일을 읽을 수 없어요. 올바른 기록 파일을 선택해 주세요.');
      }
      this.imported = validateSave(raw);
      this.importPreview();
    } catch (error) {
      if (active()) {
        const box = this.ui.querySelector('#import-error');
        if (box) box.textContent = (error as Error).message;
      }
    } finally {
      if (active()) input.value = '';
    }
  }
  private classPreview() {
    this.set(classPreviewMarkup(this.classImport!, new Set(this.profiles.book.list.map(p => p.id))), 'class-import');
  }
  private classRestore() {
    if (this.screen !== 'class-import' || !this.classImport || !this.storage) return;
    const r = restoreClass(this.storage, this.classImport);
    this.classImport = null;
    this.profiles = new Profiles(this.storage);
    this.contests = new Contests(this.storage);
    this.store = new SaveStore(this.storage, profileKey(this.profiles.active.id));
    this.selected = this.store.data.lastStage;
    this.resizeDisplay();
    this.settings();
    this.notice(
      `반 전체 기록을 가져왔어요. 합친 항해사 ${r.merged}명 · 새 항해사 ${r.added}명 · 대회 ${r.contests}개${r.skipped ? ` · 인원 초과로 건너뜀 ${r.skipped}명` : ''}`,
    );
  }
  private importPreview() {
    this.set(importPreviewMarkup(this.imported!), 'import');
  }
  private error() {
    this.sound.setPlaying(false);
    this.set(
      `<div class="veil"><section class="panel"><h1 tabindex="-1">항해 준비가 멈췄어요</h1><p>필요한 그림을 불러오지 못했어요.<br>연결을 확인하고 다시 준비해 주세요.</p>${button('reload', '다시 준비하기', 'primary')}</section></div>`,
      'error',
    );
  }
  // Buttons carry "name" or "name:argument" in data-action. Routes with an argument come first.
  private readonly argRoutes: [string, (arg: string) => void][] = [
    ['download-stage:', id => STAGES.includes(id as StageId) && void this.offline.download(id as StageId)],
    ['equip:', arg => this.equip(arg)],
    ['endless:', id => STAGES.includes(id as StageId) && void this.prepareEndless(id as StageId)],
    ['boss:', id => STAGES.includes(id as StageId) && void this.prepareBoss(id as StageId)],
    ['discovery:', id => this.discovery(id)],
    ['stage:', id => STAGES.includes(id as StageId) && void this.prepare(id as StageId)],
    ['sheet:', id => this.sheet(id)],
    ['person:', id => this.person(id)],
    ['contest-', arg => this.contestAction(...(arg.split(':') as [string, string]))],
    ['profile-', arg => this.profileAction(...(arg.split(':') as [string, string]))],
    ['quiz-answer:', n => this.quizAnswer(Number(n))],
    ['story:', n => this.story(Number(n))],
  ];
  private readonly routes: Record<string, () => void> = {
    offline: () => {
      this.offlinePage();
      void this.offline.refresh();
    },
    'offline-refresh': () => void this.offline.refresh(),
    update: () => void this.offline.update(),
    wardrobe: () => this.wardrobe(),
    quiz: () => this.quiz(),
    share: () => this.screen === 'result' && this.sharePage(),
    'share-copy': () => void this.shareAction('copy'),
    'share-native': () => void this.shareAction('native'),
    'share-image': () => this.screen === 'share' && void this.shareImage(),
    'rival-start': () => this.screen === 'rival' && void this.rivalStart(),
    profiles: () => this.profilesPage(),
    progress: () => {
      this.abandon();
      this.world.showHome();
      this.set(
        progressMarkup(this.header('학생별 진행 현황', 'profiles'), this.profiles.progress(), this.offline.version),
        'progress',
      );
    },
    'progress-csv': () =>
      this.download(
        progressCsv(this.profiles.progress()),
        `odyssey-run-progress-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.csv`,
        'text/csv;charset=utf-8',
      ),
    contests: () => this.contestsPage(),
    daily: () => void this.prepareDaily(),
    challenges: () => this.challenges(),
    journal: () => this.journal(),
    harbor: () => this.harbor(),
    quit: () => this.quit(),
    'close-tab': () => {
      try {
        window.close();
      } catch {}
      this.notice('이 브라우저에서는 탭을 직접 닫아 주세요. 게임과 소리는 멈춰 있어요.');
    },
    'touch-layout': () => {
      this.controlsReturn = this.screen === 'pause';
      this.touchLayout();
    },
    'layout-save': () => {
      this.store.persist();
      this.notice();
      this.closeLayout();
    },
    'layout-reset': () => {
      this.store.data.preferences.touch = defaultPreferences().touch;
      this.touchLayout();
    },
    fullscreen: () => void this.fullscreen(),
    home: () => this.home(),
    islands: () => this.islands(),
    codex: () => this.codex(),
    settings: () => this.settings(),
    bestiary: () => this.bestiary(),
    people: () => this.people(),
    relics: () => this.relics(),
    landscapes: () => this.landscapes(),
    'sheet-zoom': () => this.sheetZoom(),
    start: () => {
      if (this.screen !== 'prepare') return;
      this.immersive();
      this.start();
    },
    restart: () => {
      if (!['pause', 'result', 'share'].includes(this.screen)) return;
      this.immersive();
      this.start();
    },
    pause: () => this.pause(),
    resume: () => this.screen === 'pause' && this.beginCountdown(),
    export: () => this.export(),
    original: () => {
      try {
        this.download(localStorage.getItem(this.store.key) || '', `odyssey-run-original.json`);
      } catch {
        this.notice('원본을 읽지 못했어요.');
      }
    },
    'class-export': () => this.classExport(),
    'storage-tidy': () => {
      if (backupAge(this.storage) !== 0) return;
      const n = dropSpareCopies(this.storage);
      this.settings();
      this.notice(`복원 전 사본 ${n}개를 정리했어요. 기록은 그대로예요.`);
    },
    protect: () => this.askProtection(),
    'class-import-confirm': () => this.classRestore(),
    'import-confirm': () => this.importConfirm(),
    'reset-confirm': () =>
      this.set(
        `<div class="veil"><section class="panel"><span class="eyebrow">START A NEW JOURNEY</span><h1 tabindex="-1">기록을 초기화할까요?</h1><p>이 게임의 섬 완료, 최고 기록, 지도 조각,<br>설정과 백업을 모두 지워요.</p><p class="muted">다른 앱의 데이터는 유지돼요.<br>필요하면 먼저 기록을 내보내세요.</p><div class="button-row">${button('settings', '취소', 'secondary')}${button('reset', '초기화하기', 'danger-button')}</div></section></div>`,
        'reset',
      ),
    reset: () => {
      if (this.screen !== 'reset') return;
      this.store.reset();
      this.selected = 'beach';
      this.resizeDisplay();
      this.settings();
    },
    reload: () => location.reload(),
  };
  private action(action: string) {
    const route = this.argRoutes.find(([prefix]) => action.startsWith(prefix));
    if (route) route[1](action.slice(route[0].length));
    else if (Object.hasOwn(this.routes, action)) this.routes[action]();
  }
  private equip(arg: string) {
    const [slot, id] = arg.split(':'),
      entry = COSMETICS.find(c => c.slot === slot && c.id === id);
    if (!entry || !cosmeticUnlocked(this.store.data, id)) return;
    this.store.data.preferences[entry.slot] = entry.id as never;
    this.store.persist();
    this.wardrobe();
  }
  private sheetZoom() {
    if (this.screen !== 'sheet') return;
    const expanded = this.ui.querySelector('.sheet-viewer')!.classList.toggle('expanded'),
      b = this.ui.querySelector('[data-action="sheet-zoom"]')!;
    b.setAttribute('aria-pressed', String(expanded));
    b.textContent = translate(expanded ? '화면에 맞추기' : '원본 크기로 확대');
  }
  private classExport() {
    if (!this.storage) return;
    this.protect();
    markBackup(this.storage);
    this.download(
      JSON.stringify(classBackup(this.storage)),
      `odyssey-run-class-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`,
    );
    this.setText('#protection', this.protectionLine());
  }
  private askProtection() {
    void requestProtection().then(p => {
      this.protectionState = p;
      if (this.screen === 'settings') this.settings();
      this.notice(
        p === 'persisted'
          ? '이 브라우저가 기록을 지우지 않도록 보호해요.'
          : '브라우저가 보호 요청을 받아들이지 않았어요. 반 전체 백업을 자주 해 주세요.',
      );
    });
  }
  private importConfirm() {
    if (this.screen !== 'import' || !this.imported) return;
    const ok = this.store.replace(this.imported);
    this.imported = null;
    this.settings();
    if (ok) {
      this.resizeDisplay();
      this.notice('기록 파일을 복원했어요.');
    }
  }
  private frame(delta: number) {
    if (this.destroyed) return;
    if (this.screen === 'quit') {
      this.game.loop.sleep();
      return;
    }
    this.sound.update();
    if (this.screen === 'countdown' && !document.hidden) {
      this.countdown -= Math.min(delta, 0.1);
      const n = document.querySelector('#count');
      if (n) n.textContent = String(Math.max(1, Math.ceil(this.countdown)));
      if (this.countdown <= 0) this.play();
    } else if (this.screen === 'play' && this.run?.state === 'playing') {
      this.accumulator += Math.min(delta, 0.1) * this.assist().pace;
      while (this.accumulator >= C.step) {
        this.run.tick();
        this.accumulator -= C.step;
        for (const e of this.run.events) {
          this.sound.effect(e.kind);
          vibrate(e.kind, this.store.data.preferences.haptics);
          this.world.feedback(e.kind, e.x, e.y, e.text);
        }
        if (this.run.state !== 'playing') {
          this.accumulator = 0;
          this.finish();
          break;
        }
      }
      if (this.screen === 'play') this.updateHud();
      if (this.frameWatch.add(delta)) this.slowDevice();
    }
  }
  // "Auto" quality also steps down for good once this device has struggled to keep up.
  private quality(): Quality {
    const q = this.store.data.preferences.quality;
    try {
      if (q === 'auto' && this.storage?.getItem(SLOW_KEY)) return 'low';
    } catch {}
    return q;
  }
  private slowDevice() {
    if (this.store.data.preferences.quality !== 'auto') return;
    try {
      this.storage?.setItem(SLOW_KEY, '1');
    } catch {}
    const before = this.renderDensity;
    this.resizeDisplay();
    if (this.renderDensity < before)
      this.notice('화면이 끊겨서 그래픽을 가볍게 바꿨어요. 설정 → 그래픽 품질에서 바꿀 수 있어요.');
  }
  private setText(selector: string, text: string) {
    const el = this.ui.querySelector(selector);
    text = translate(text);
    if (el && el.textContent !== text) el.textContent = text;
  }
  private updateHud() {
    const r = this.run;
    if (!r || !this.ui.querySelector('#hp')) return;
    // Progress and the ghost move every frame; everything else is rewritten only when its value changes.
    const progress = this.ui.querySelector<HTMLProgressElement>('#progress')!;
    progress.max = r.length;
    progress.value = Math.min(r.length, r.x);
    progress.dataset.distance = String(r.x);
    this.setText('#progress-label', Math.min(100, Math.floor((r.x / r.length) * 100)).toString() + '%');
    const rival = this.rivalFor(this.selected, r.variant),
      ghost = this.special
        ? null
        : ghostDistance(rival?.ghost ?? courseGhost(this.store.data, this.selected, r.variant), r.time),
      who = rival ? `친구 ‘${rival.name}’` : '나의 비교 항해',
      marker = this.ui.querySelector<HTMLElement>('#ghost-marker')!;
    marker.hidden = ghost === null;
    if (ghost !== null) marker.style.left = `${ghost / 240}%`;
    this.setText(
      '#ghost-delta',
      ghost === null
        ? '이 코스의 첫 기록을 남겨 보세요'
        : Math.abs(r.x - ghost) <= C.speed * C.step * 2
          ? `${who} · 나란히`
          : `${who} ${Math.floor(Math.abs(r.x - ghost) / 10)}m ${r.x >= ghost ? '앞' : '뒤'}`,
    );
    const text = [
      r.hp,
      r.points,
      r.maps.size,
      r.stars,
      Math.ceil(r.wings),
      Math.ceil(r.magnet),
      r.shield,
      r.trident,
      Math.ceil(r.lantern),
      r.goalProgress,
      r.constellations.size,
      r.stories.size,
      r.nearMisses.size,
    ].join();
    if (text === this.lastHud) return;
    this.lastHud = text;
    const hp = this.ui.querySelector('#hp')!;
    hp.innerHTML = `<span>${'♥'.repeat(Math.max(0, r.hp))}</span><em>${'♡'.repeat(3 - Math.max(0, r.hp))}</em>`;
    hp.setAttribute('aria-label', `체력 ${Math.max(0, r.hp)}`);
    this.setText('#score', r.points.toLocaleString());
    this.setText('#stars', `✦ ${r.stars} / 100`);
    this.setText(
      '#maps',
      this.special === 'boss'
        ? '⚔ 3단계 돌파'
        : this.special === 'endless'
          ? `∞ ${sectionsPassed(r.maxDistance)}구간`
          : `지도 ${r.maps.size} / 3`,
    );
    const g = GOALS[r.goal];
    this.setText(
      '#goal-progress',
      this.special
        ? this.special === 'boss'
          ? '⚔ 보스 도전 · 예고를 읽어요'
          : this.special === 'contest'
            ? `⚑ 대회 · ${this.contest!.title}`
            : this.special === 'endless'
              ? `∞ 끝없는 항해 · ${this.endless!.date} 순서`
              : `◇ 오늘의 항해 · ${this.daily!.name}`
        : `${r.goalComplete ? '✓' : '◇'} ${g.name} ${Math.min(g.target, r.goalProgress)}/${g.target}`,
    );
    this.setText('#discovery-progress', `✧ 별자리 ${r.constellations.size}/3 · 회피 ${r.nearMisses.size}`);
    this.setText(
      '#effects',
      [
        r.shield ? '⬡ 방패' : '',
        r.trident ? '⚒ 삼지창 1회' : '',
        r.lantern > 0 ? `등불 ${Math.ceil(r.lantern)}초` : '',
        r.wings > 0 ? `날개 ${Math.ceil(r.wings)}초` : '',
        r.magnet > 0 ? `자석 ${Math.ceil(r.magnet)}초` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    );
  }
  // Phones held upright play too: the game becomes a 16:9 strip under the score with large
  // buttons below it (CSS keyed on data-portrait). Turning the phone mid-run pauses the run,
  // because everything moves under the player's thumbs.
  private portrait = false;
  private orientation() {
    const portrait = innerHeight > innerWidth && (navigator.maxTouchPoints > 0 || innerWidth < 700),
      changed = portrait !== this.portrait;
    this.portrait = portrait;
    document.querySelector<HTMLElement>('#app')!.dataset.portrait = String(portrait);
    if (changed && this.run && ['play', 'countdown'].includes(this.screen)) this.pause();
  }
  private resizeDisplay() {
    if (!this.game?.isBooted || this.destroyed) return;
    const rect = document.querySelector('#game')!.getBoundingClientRect(),
      view = displayViewport(rect.width, rect.height, this.portrait ? PORTRAIT_VIEW : 960),
      density = displayDensity(rect.width, window.devicePixelRatio, rect.height, this.quality());
    if (
      density === this.renderDensity &&
      Math.abs(view.width - this.view.width) < 0.01 &&
      Math.abs(view.height - this.view.height) < 0.01
    )
      return;
    this.view = view;
    this.renderDensity = density;
    this.game.scale.setGameSize(Math.round(view.width * density), Math.round(view.height * density));
    this.game.scale.refresh();
    this.world.syncDisplay();
    // The quit screen sleeps the loop; draw one frame so the resized canvas is not left blank.
    if (this.screen === 'quit') this.game.loop.wake();
  }
  destroy() {
    this.destroyed = true;
    this.displayObserver.disconnect();
    this.abort.abort();
    this.controls.destroy();
    this.sound.destroy();
    this.offline.destroy();
    this.game.destroy(true);
  }
}
