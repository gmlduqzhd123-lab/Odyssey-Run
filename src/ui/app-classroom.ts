import {translate} from '../i18n';
import {koreanDay} from '../levels/daily';
import {Contests} from '../storage/contests';
import {Gallery} from '../storage/gallery';
import {backupAge, iosBrowserTab, markBackup, requestProtection} from '../storage/durability';
import {freeRemixGhosts, storageUse, STORAGE_LIMIT} from '../storage/durability';
import {classBackup, readClassBackup, restoreClass, CLASS_BACKUP_LIMIT} from '../storage/backup';
import {Profiles, profileKey, MAX_PROFILES, MAIN_PROFILE} from '../storage/profiles';
import {SaveStore, validateSave} from '../storage/save';
import {deleteSailorMarkup, profilesMarkup} from './profiles-view';
import {readJsonFile} from '../storage/json-file';
import {FLEET_KEY, TEAMS_KEY, TEAMS, readTeams} from '../storage/class-device';
import {weekKey} from '../storage/feats';
import type {App} from './app';
import {STAGES, type StageId} from '../levels/courses';
import {newContestId} from '../storage/contests';
import {teacherViews, settingsModule, settingsView, LIVE_KEY, classModule, classView} from './app-shared';
// Loaded before any of these methods use it (see profilesPage).
const cv = () => classModule!;
// The class's pages on the shared device: sailors, the teacher's pages, the live mission, teams, the fleet, record protection and class backups. Methods of App (see ui/app),
// kept here to keep that file readable.
export const classroomMethods = {
  profilesPage(this: App, message = '') {
    this.abandon();
    this.world.showHome();
    if (!classModule) {
      void this.later(classView, () => this.profilesPage(message));
      return;
    }
    const board = this.profiles.board(),
      active = this.profiles.active.id;
    this.set(
      profilesMarkup(
        this.header('항해사'),
        board,
        active,
        this.profiles.book.list.length,
        message,
        this.fleet(
          board.reduce((n, p) => n + p.stars, 0),
          board.length,
        ) +
          cv().horseMarkup(
            board.filter(p => p.week === weekKey(koreanDay())).reduce((n, p) => n + p.weekRuns, 0),
            board.length,
          ) +
          cv().liveMarkup(
            this.live(),
            this.classStars(board),
            board.length,
            Date.now(),
            this.liveTeams(board),
            this.liveDevices(),
          ),
      ),
      'profiles',
    );
    // The live mission's clock ticks on the board; when time is up the page shows the outcome.
    const m = this.live();
    if (m && cv().liveLeft(m, Date.now()) > 0)
      this.liveTimer = window.setInterval(() => {
        const left = cv().liveLeft(m, Date.now());
        if (this.screen !== 'profiles') return clearInterval(this.liveTimer);
        if (!left) return this.profilesPage();
        this.setText('#live-time', '남은 시간 ' + cv().clock(left));
      }, 1000);
  },
  teacherPage(this: App, show: (views: Awaited<ReturnType<typeof teacherViews>>) => void) {
    return this.later(teacherViews, show);
  },
  live(this: App) {
    try {
      return cv().readLive(this.storage?.getItem(LIVE_KEY) ?? null);
    } catch {
      return null;
    }
  },
  // Other devices' starlight in the live mission: each sailor's best run in the mission's contest.
  liveDevices(this: App) {
    const id = this.live()?.contest,
      c = id ? this.contests.find(id) : null;
    return {stars: c ? c.entries.reduce((n, e) => n + e.stars, 0) : 0, sailors: c?.entries.length ?? 0};
  },
  // This week's starlight of every sailor on this device (the live mission's measure).
  classStars(this: App, board = this.profiles.board()) {
    const week = weekKey(koreanDay());
    return board.filter(p => p.week === week).reduce((n, p) => n + p.weekStars, 0);
  },
  teams(this: App) {
    try {
      return readTeams(this.storage?.getItem(TEAMS_KEY) ?? null);
    } catch {
      return {};
    }
  },
  // Each sailor's starlight this week, by team (the team race's measure).
  liveTeams(this: App, board = this.profiles.board()) {
    const week = weekKey(koreanDay()),
      teams = this.teams();
    return {
      sailors: board.map(p => ({id: p.id, name: p.name})),
      teams,
      now: cv().teamStars(
        board.map(p => ({id: p.id, stars: p.week === week ? p.weekStars : 0})),
        teams,
      ),
    };
  },
  liveStart(this: App) {
    if (this.screen !== 'profiles') return;
    const minutes = Number(this.ui.querySelector<HTMLSelectElement>('#live-minutes')?.value),
      goal = Math.round(Number(this.ui.querySelector<HTMLInputElement>('#live-goal')?.value));
    if (!cv().LIVE_MINUTES.includes(minutes) || !Number.isSafeInteger(goal) || goal < 10 || goal > 100_000) return;
    try {
      // Two or more teams with sailors make it a team race, each from its own starlight now.
      const t = this.liveTeams(),
        used = TEAMS.filter(k => Object.values(t.teams).includes(k)),
        teams = used.length >= 2 ? Object.fromEntries(used.map(k => [k, t.now[k] ?? 0])) : undefined,
        island = this.ui.querySelector<HTMLSelectElement>('#live-devices')?.value as StageId,
        // Other devices join through a contest made for this mission (whole-class missions only).
        contest =
          !teams && STAGES.includes(island)
            ? this.contests.host({
                id: newContestId(),
                title: '실시간 미션',
                stage: island,
                variant: 'classic',
                assist: false,
              }).id
            : undefined;
      this.storage?.setItem(
        LIVE_KEY,
        JSON.stringify({
          start: Date.now(),
          minutes,
          goal,
          base: this.classStars(),
          ...(teams ? {teams} : {}),
          ...(contest ? {contest} : {}),
        }),
      );
    } catch {}
    this.profilesPage();
  },
  fleetGoal(this: App, sailors: number) {
    try {
      const n = Number(this.storage?.getItem(FLEET_KEY));
      if (Number.isSafeInteger(n) && n >= 50 && n <= 100_000) return n;
    } catch {}
    return cv().defaultFleetGoal(sailors);
  },
  fleet(this: App, stars: number, sailors: number) {
    return cv().fleetMarkup(stars, this.fleetGoal(sailors), sailors);
  },
  setFleetGoal(this: App) {
    const n = Math.round(Number(this.ui.querySelector<HTMLInputElement>('#fleet-goal')?.value) / 50) * 50;
    if (!Number.isFinite(n) || n < 50 || n > 100_000) {
      this.notice('함대 목표는 별빛 50에서 100,000 사이로 정해 주세요.');
      return;
    }
    try {
      this.storage?.setItem(FLEET_KEY, String(n));
    } catch {}
    if (this.screen === 'progress') this.routes.progress();
    else this.profilesPage('함대 목표를 바꿨어요.');
  },
  switchProfile(this: App, id: string, message: string) {
    if (!this.profiles.use(id)) {
      this.profilesPage('항해사를 바꾸지 못했어요. 브라우저 저장 권한을 확인해 주세요.');
      return;
    }
    this.abandon();
    this.store = new SaveStore(this.storage, profileKey(id));
    this.store.onFull = () => freeRemixGhosts(this.storage);
    this.selected = this.store.data.lastStage;
    this.selectedVariant = 'classic';
    this.question = null;
    this.resizeDisplay();
    this.sound.changed();
    this.profilesPage(message);
  },
  profileAction(this: App, kind: string, id = '') {
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
        this.set(deleteSailorMarkup(p.name), 'profile-delete');
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
  },
  protect(this: App) {
    if (this.protectionAsked || this.protectionState === 'persisted') return;
    this.protectionAsked = true;
    void requestProtection().then(p => (this.protectionState = p));
  },
  protectionLine(this: App) {
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
  },
  async readClassFile(this: App, input: HTMLInputElement, file: File) {
    const box = this.ui.querySelector('#import-error');
    try {
      const raw = await readJsonFile(file, CLASS_BACKUP_LIMIT, '반 전체 백업 파일은 4MB 이하여야 해요.');
      if (this.screen !== 'settings') return;
      this.classImport = readClassBackup(raw);
      this.classPreview();
    } catch (error) {
      if (box) box.textContent = (error as Error).message;
    } finally {
      input.value = '';
    }
  },
  async readSaveFile(this: App, input: HTMLInputElement, file: File) {
    const request = ++this.importRequest;
    const active = () =>
      !this.destroyed && request === this.importRequest && this.screen === 'settings' && input.isConnected;
    try {
      const raw = await readJsonFile(file, 131072, '기록 파일은 128KiB 이하여야 해요.');
      if (!active()) return;
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
  },
  classPreview(this: App) {
    const preview = (m: typeof import('./settings-view')) =>
      this.set(
        m.classPreviewMarkup(this.classImport!, new Set(this.profiles.book.list.map(p => p.id))),
        'class-import',
      );
    if (settingsModule) preview(settingsModule);
    else void this.later(settingsView, preview);
  },
  classRestore(this: App) {
    if (this.screen !== 'class-import' || !this.classImport || !this.storage) return;
    const r = restoreClass(this.storage, this.classImport);
    this.classImport = null;
    this.profiles = new Profiles(this.storage);
    this.contests = new Contests(this.storage);
    this.gallery = new Gallery(this.storage);
    this.store = new SaveStore(this.storage, profileKey(this.profiles.active.id));
    this.store.onFull = () => freeRemixGhosts(this.storage);
    this.selected = this.store.data.lastStage;
    this.resizeDisplay();
    this.settings();
    this.notice(
      `반 전체 기록을 가져왔어요. 합친 항해사 ${r.merged}명 · 새 항해사 ${r.added}명 · 대회 ${r.contests}개${r.gallery ? ` · 갤러리 코스 ${r.gallery}개` : ''}${r.skipped ? ` · 인원 초과로 건너뜀 ${r.skipped}명` : ''}`,
    );
  },
  importPreview(this: App) {
    const preview = (m: typeof import('./settings-view')) => this.set(m.importPreviewMarkup(this.imported!), 'import');
    if (settingsModule) preview(settingsModule);
    else void this.later(settingsView, preview);
  },
  classExport(this: App) {
    if (!this.storage) return;
    this.protect();
    markBackup(this.storage);
    this.download(
      JSON.stringify(classBackup(this.storage)),
      `odyssey-run-class-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`,
    );
    this.setText('#protection', this.protectionLine());
  },
  askProtection(this: App) {
    void requestProtection().then(p => {
      this.protectionState = p;
      if (this.screen === 'settings') this.settings();
      this.notice(
        p === 'persisted'
          ? '이 브라우저가 기록을 지우지 않도록 보호해요.'
          : '브라우저가 보호 요청을 받아들이지 않았어요. 반 전체 백업을 자주 해 주세요.',
      );
    });
  },
  importConfirm(this: App) {
    if (this.screen !== 'import' || !this.imported) return;
    const ok = this.store.replace(this.imported);
    this.imported = null;
    this.settings();
    if (ok) {
      this.resizeDisplay();
      this.notice('기록 파일을 복원했어요.');
    }
  },
};
