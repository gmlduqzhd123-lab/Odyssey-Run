import {linkUrl, parseLinkText, type ContestLink, type ContestResult} from '../systems/share';
import {contestLength, newContestId, type Entry} from '../storage/contests';
import {esc} from './html';
import {COURSES, STAGES, type StageId} from '../levels/courses';
import {isVariant, type VariantId} from '../levels/course-ids';
import type {App} from './app';
import {contestView} from './app-shared';
// Teacher contests: joining a contest link, its run and result, the board with its QR scanner and CSV. Methods of App (see ui/app).
export const contestMethods = {
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
};
