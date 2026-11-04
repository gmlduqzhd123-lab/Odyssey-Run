import {COURSES, STAGES} from '../levels/courses';
import {VARIANTS} from '../levels/variants';
import {
  contestLength,
  leaderOf,
  rank,
  suspicion,
  type HostedContest,
  type Contests,
  type Entry,
} from '../storage/contests';
import {linkUrl, parseLinkText, qrSvg, type ContestLink} from '../systems/share';
import type {RunResult} from '../storage/save';
import {Scanner, toCsv} from '../systems/scanner';
import {vibrate} from '../systems/haptics';
import {translate} from '../i18n';
import {button, esc} from './html';
// The teacher's contest screens: the contest list, one board, its camera and its CSV export.
export function contestsMarkup(header: string, hosted: HostedContest[], message: string) {
  return `<div class="page contests">${header}<div class="page-heading"><span class="eyebrow">FOR TEACHERS</span><h1 tabindex="-1">우리 반 대회 열기</h1><p>코스를 정해 QR을 띄우면 학생들이 카메라로 찍고 참가해요. 결과 QR을 찍으면 이 기기에 순위표가 모여요. 서버로 보내지 않아요.</p></div><section class="contest-form"><h2>새 대회</h2><label>대회 이름 <input id="contest-title" maxlength="12" placeholder="예: 3반 해변 대회"></label><label>섬 <select id="contest-stage">${STAGES.map(id => `<option value="${id}">${COURSES[id].name}</option>`).join('')}</select></label><label>코스 <select id="contest-variant">${VARIANTS.map((v, i) => `<option value="${v}">${['기본 항로', '변형 코스 A', '변형 코스 B'][i]}</option>`).join('')}</select></label><label class="toggle"><span>쉬운 항해 허용</span><input type="checkbox" id="contest-assist"><i aria-hidden="true"></i></label>${button('contest-create', '대회 만들기', 'primary')}<p role="status" id="contest-message">${esc(message)}</p></section><section class="contest-list"><h2>이 기기의 대회</h2>${hosted.length ? hosted.map(c => `<p>${button('contest-open:' + c.id, `<b>${esc(c.title)}</b> · 참가 ${c.entries.length}명`, 'secondary')}</p>`).join('') : '<p class="muted">아직 만든 대회가 없어요.</p>'}<label>결과 코드 붙여넣기 <input id="contest-code" autocomplete="off" placeholder="학생 화면의 결과 코드"></label>${button('contest-paste', '결과 추가', 'secondary')}${button('gallery', '🗂 반 코스 갤러리', 'text-button')}</section></div>`;
}
// The join link for a board with a course; with the leader, it also carries the leader's ghost.
export function joinLink(c: HostedContest, base: string, withLeader = false) {
  if (!c.stage || !c.variant) return '';
  const leader = withLeader ? leaderOf(c) : null;
  if (withLeader && !leader?.ghost) return '';
  return linkUrl(
    {
      kind: 'contest',
      id: c.id,
      title: c.title,
      stage: c.stage,
      variant: c.variant,
      assist: c.assist,
      ...(c.blocks ? {blocks: c.blocks} : {}),
      ...(leader?.ghost ? {leader: {name: leader.name, score: leader.score, ghost: leader.ghost}} : {}),
    },
    base,
  );
}
// A second join QR for students joining late: they race the current leader's ghost. Rebuilt in
// place whenever a scanned result changes the leader.
export function raceMarkup(c: HostedContest, base: string) {
  const url = joinLink(c, base, true),
    leader = leaderOf(c);
  if (!url || !leader) return '';
  return `<details class="race-leader"><summary>🏁 1등 기록과 겨루기 QR</summary><p class="muted">지금 1등 <b translate="no">${esc(leader.name)}</b> ${leader.score.toLocaleString()}점의 배가 참가자의 진행 막대에 함께 보여요. 1등이 바뀌면 이 QR도 바로 바뀌어요.</p><div class="qr-box" role="img" aria-label="1등 기록과 겨루는 참가 QR 코드">${qrSvg(url)}</div><label class="share-url">겨루기 링크 <input readonly value="${esc(url)}"></label></details>`;
}
export function boardMarkup(header: string, c: HostedContest, rules: string, message: string, base: string) {
  const join = joinLink(c, base);
  return `<div class="page contest-board">${header}<div class="contest-layout"><section class="contest-join-box"><h1 tabindex="-1">${esc(c.title)}</h1><p>${rules}</p>${join ? `<div class="qr-box" role="img" aria-label="대회 참가 QR 코드">${qrSvg(join)}</div><p class="muted">학생은 카메라로 찍어 참가해요.</p><label class="share-url">참가 링크 <input id="share-url" readonly value="${esc(join)}"></label>${button('share-copy', '참가 링크 복사', 'secondary')}<p role="status" id="share-status"></p><div id="race-leader">${raceMarkup(c, base)}</div>` : '<p class="muted">결과만 모으는 순위표예요. 대회를 만든 기기에서 참가 QR을 띄워 주세요.</p>'}</section><section class="class-board"><h2>순위 <small id="board-count">${c.entries.length}명</small></h2><p role="status" id="contest-message">${esc(message)}</p><div class="scanner" hidden><video aria-label="결과 QR 카메라"></video><p role="status" id="scan-status">결과 QR을 카메라에 비춰 주세요. 여러 장을 차례로 찍을 수 있어요.</p></div><div class="button-row">${button('contest-scan:' + c.id, '📷 결과 QR 연속 찍기', 'primary')}${button('contest-csv:' + c.id, '순위 CSV 내보내기', 'secondary')}</div><ol id="board-list">${boardRows(c)}</ol><label>결과 코드 붙여넣기 <input id="contest-code" autocomplete="off"></label><div class="button-row">${button('contest-paste', '결과 추가', 'secondary')}${button('contest-clear:' + c.id, '순위 비우기', 'text-button')}${button('contest-delete:' + c.id, '대회 지우기', 'text-button danger')}</div></section></div></div>`;
}
export function boardRows(c: HostedContest) {
  const id = c.id;
  return rank(c.entries)
    .map((e, i) => {
      const doubt = suspicion(e, contestLength(c));
      return `<li${doubt ? ' class="doubt"' : ''}><span class="rank">${i + 1}</span><b translate="no">${esc(e.name)}</b><span>${e.score.toLocaleString()}점</span><span>${e.complete ? '⚑ 완주' : '도전'}</span><span>별빛 ${e.stars}</span><span>HP 손실 ${e.hpLoss}</span>${doubt ? `<em title="${doubt}">⚠ 확인 필요: ${doubt}</em>` : ''}${button(`contest-drop:${id}/${encodeURIComponent(e.name)}`, '빼기', 'text-button', `aria-label="‘${esc(e.name)}’ 기록 빼기"`)}</li>`;
    })
    .join('');
}
export function contestCsv(entries: Entry[], length?: number) {
  return toCsv([
    ['등수', '이름', '점수', '완주', '별빛', '지도', 'HP 손실', '시간(초)', '확인 필요'].map(h => translate(h)),
    ...rank(entries).map((e, i) => {
      const doubt = suspicion(e, length);
      return [
        i + 1,
        e.name,
        e.score,
        e.complete ? 'O' : 'X',
        e.stars,
        e.maps,
        e.hpLoss,
        e.time,
        doubt ? translate(doubt) : '',
      ];
    }),
  ]);
}
// Keeps the camera open and adds each scanned result in place, without re-rendering the page.
export class BoardScanner {
  private scanner: Scanner | null = null;
  constructor(
    private root: HTMLElement,
    private id: string,
    private contests: Contests,
    private haptics: () => boolean,
  ) {
    void this.start();
  }
  private el<T extends Element>(selector: string) {
    return this.root.querySelector<T>(selector);
  }
  private say(text: string) {
    const status = this.el('#scan-status');
    if (status) status.textContent = translate(text);
  }
  private label(text: string) {
    const toggle = this.el(`[data-action="contest-scan:${this.id}"]`);
    if (toggle) toggle.textContent = translate(text);
  }
  private async start() {
    const box = this.el<HTMLElement>('.scanner');
    if (!box) return;
    box.hidden = false;
    this.label('카메라 끄기');
    const scanner = new Scanner(box.querySelector('video')!, text => this.scanned(text));
    this.scanner = scanner;
    try {
      await scanner.start();
    } catch (error) {
      if (this.scanner !== scanner) return;
      this.scanner = null;
      scanner.stop();
      this.say((error as Error).message);
      this.label('📷 결과 QR 연속 찍기');
    }
  }
  private scanned(text: string) {
    let link;
    try {
      link = parseLinkText(text);
    } catch (error) {
      this.say((error as Error).message);
      return;
    }
    if (link?.kind !== 'result') {
      this.say('학생 결과 화면의 결과 QR을 찍어 주세요.');
      return;
    }
    const {contest, added} = this.contests.add(link);
    vibrate('map', this.haptics());
    if (contest.id !== this.id) {
      this.say(`다른 대회(${contest.title})의 결과라 그 순위표에 넣었어요.`);
      return;
    }
    this.say(
      added ? `‘${link.name}’ ${link.score.toLocaleString()}점을 넣었어요.` : '순위표가 가득 찼어요(최대 인원).',
    );
    const list = this.el('#board-list'),
      count = this.el('#board-count');
    if (list) list.innerHTML = boardRows(contest);
    if (count) count.textContent = translate(`${contest.entries.length}명`);
    // A new leader gets a new race QR; an open race box stays open.
    const race = this.el('#race-leader');
    if (race) {
      const open = !!race.querySelector('details')?.open;
      race.innerHTML = raceMarkup(contest, location.href);
      if (open) race.querySelector('details')?.setAttribute('open', '');
    }
  }
  stop() {
    this.scanner?.stop();
    this.scanner = null;
    const box = this.el<HTMLElement>('.scanner');
    if (box) box.hidden = true;
    this.label('📷 결과 QR 연속 찍기');
  }
}
// A student's side of a contest: the join panel, the start panel and the result with its QR.
export const contestJoinMarkup = (link: ContestLink, rules: string, sailor: string) =>
  `<div class="veil"><section class="panel contest-panel"><span class="eyebrow">CLASS CONTEST</span><h1 tabindex="-1">${esc(link.title)}</h1><p>${rules}</p>${link.leader ? `<p class="rival-result"><b>1등 ‘${esc(link.leader.name)}’ ${link.leader.score.toLocaleString()}점</b> · 달리는 동안 1등의 배가 진행 막대에 함께 보여요.</p>` : ''}<p>항해사: <b>${esc(sailor)}</b> ${button('profiles', '바꾸기', 'text-button')}</p><p class="muted">대회 기록은 일반 기록·지도·해금에 반영하지 않아요. 잠긴 섬도 대회에서는 달릴 수 있어요. 끝나면 결과 QR을 선생님께 보여 주세요.</p>${button('contest-run', '대회 달리기 →', 'primary large')}<div class="button-row">${button('contest-host-here', '선생님: 이 기기에서 결과 모으기', 'secondary')}${button('home', '시작 화면으로', 'secondary')}</div></section></div>`;
export const contestStartMarkup = (link: ContestLink, rules: string, sailor: string) =>
  `<div class="veil"><section class="panel"><span class="eyebrow">CLASS CONTEST</span><h1 tabindex="-1">${esc(link.title)}</h1><p>${rules}</p><p>항해사 <b>${esc(sailor)}</b> · 몇 번이든 다시 달릴 수 있고, 가장 좋은 기록을 보여 줄 수 있어요.</p>${button('start', '출발 →', 'primary large')}${button('home', '그만두기', 'secondary')}</section></div>`;
export const contestResultMarkup = (title: string, r: RunResult, best: Entry, url: string, rival: string) =>
  `<div class="veil"><section class="panel result contest-result"><span class="eyebrow">CLASS CONTEST · ${esc(title)}</span><h1 tabindex="-1">${r.complete ? '대회 코스 완주!' : '대회 기록을 남겼어요'}</h1><div class="result-score"><span>이번 점수</span><strong>${r.score.toLocaleString()}</strong><small>나의 대회 최고 ${best.score.toLocaleString()} · ${esc(best.name)}</small></div><p>별빛 ${r.stars} · 지도 ${r.maps.length} · HP 손실 ${r.hpLoss}회</p>${rival}<div class="qr-box" role="img" aria-label="대회 결과 QR 코드">${qrSvg(url)}</div><p class="muted">선생님이 휴대폰 카메라로 찍으면 순위표에 들어가요. 가장 좋은 기록이 담겨 있어요.</p><label class="share-url">결과 코드 <input id="share-url" readonly value="${esc(url)}"></label><p role="status" id="share-status"></p><div class="button-row">${button('restart', '다시 달리기', 'primary')}${button('share-copy', '코드 복사', 'secondary')}${button('home', '시작 화면', 'secondary')}</div></section></div>`;
