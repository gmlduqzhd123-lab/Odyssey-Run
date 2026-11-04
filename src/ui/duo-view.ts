import {COURSES} from '../levels/courses';
import type {StageId} from '../levels/courses';
import type {Runner} from '../player/runner';
import type {RunResult} from '../storage/save';
import {button, esc} from './html';
// Two sailors on one screen: taking turns, or at the same time on a split screen.
export interface Duo {
  names: [string, string];
  stage: StageId;
  scores: RunResult[];
  together: boolean;
}
export function duoPageMarkup(header: string, open: StageId[], message: string) {
  return `<div class="page duo">${header}<div class="page-heading"><span class="eyebrow">TWO SAILORS, ONE SCREEN</span><h1 tabindex="-1">둘이서 번갈아 달리기</h1><p>한 화면에서 두 명이 같은 코스를 차례로 달리고, 두 점수를 합쳐 팀 점수를 만들어요. 기록·해금에는 반영하지 않아요.</p></div><section class="maker-form"><div class="maker-meta"><label>첫 번째 항해사 <input id="duo-a" maxlength="12" autocomplete="off" placeholder="예: 지우"></label><label>두 번째 항해사 <input id="duo-b" maxlength="12" autocomplete="off" placeholder="예: 민준"></label><label>섬 <select id="duo-stage">${open.map(id => `<option value="${id}">${COURSES[id].name}</option>`).join('')}</select></label></div><label class="toggle"><span>동시에 달리기 (화면을 위아래로 나눠요)</span><input type="checkbox" id="duo-together"><i aria-hidden="true"></i></label><small>동시에 달리면 위 화면은 Space·↑·↓와 위쪽 버튼, 아래 화면은 W·S와 아래쪽 버튼으로 달려요. 게임패드가 두 개면 하나씩 나눠 써요. 휴대폰은 가로로 돌려 주세요.</small>${button('duo-start', '출발 준비 →', 'primary')}<p role="status" id="duo-message">${esc(message)}</p><small>전자칠판이나 한 대의 태블릿에서 함께 달리기 좋아요.</small></section></div>`;
}
export const duoLoadingMarkup = () =>
  `<div class="veil"><section class="panel"><h1 tabindex="-1">두 번째 화면 준비 중</h1><p>두 번째 항해사의 화면을 준비하고 있어요…</p>${button('duo', '그만두기', 'secondary')}</section></div>`;
export function duoPrepareMarkup(d: Duo) {
  const who = d.names[d.scores.length];
  return d.together
    ? `<div class="veil"><section class="panel"><span class="eyebrow">TWO SAILORS · TOGETHER</span><h1 tabindex="-1">‘${esc(d.names[0])}’와 ‘${esc(d.names[1])}’ 함께 출발</h1><p>${COURSES[d.stage].name} · 기본 항로 · 약 75초</p><div class="control-guide"><div><kbd>Space / ↑ · ↓</kbd><b translate="no">${esc(d.names[0])}</b><span>위 화면 · 화면 버튼도 돼요</span></div><div><kbd>W · S</kbd><b translate="no">${esc(d.names[1])}</b><span>아래 화면 · 아래 버튼이나 두 번째 게임패드도 돼요</span></div></div>${button('start', '출발 →', 'primary large')}${button('duo', '그만두기', 'secondary')}</section></div>`
    : `<div class="veil"><section class="panel"><span class="eyebrow">TWO SAILORS · ${d.scores.length + 1} / 2</span><h1 tabindex="-1">‘${esc(who)}’ 차례예요</h1><p>${COURSES[d.stage].name} · 기본 항로 · 약 75초</p>${d.scores.length ? `<p class="muted">‘${esc(d.names[0])}’ ${d.scores[0].score.toLocaleString()}점</p>` : ''}${button('start', '출발 →', 'primary large')}${button('duo', '그만두기', 'secondary')}</section></div>`;
}
// After the first of two turns.
export const duoTurnMarkup = (d: Duo, r: RunResult) =>
  `<div class="veil"><section class="panel result special-result"><span class="eyebrow">TWO SAILORS · 1 / 2</span><h1 tabindex="-1">‘${esc(d.names[0])}’ ${r.score.toLocaleString()}점</h1><p>별빛 ${r.stars} · 지도 ${r.maps.length} · HP 손실 ${r.hpLoss}회</p>${button('duo-next', `‘${esc(d.names[1])}’ 차례로 →`, 'primary large')}${button('duo', '그만두기', 'secondary')}</section></div>`;
export function duoTeamMarkup(d: Duo) {
  const [x, y] = d.scores,
    lead =
      x.score === y.score
        ? '똑같은 점수예요!'
        : `‘${esc(d.names[x.score > y.score ? 0 : 1])}’ ${Math.abs(x.score - y.score).toLocaleString()}점 앞섰어요`;
  return `<div class="veil"><section class="panel result special-result"><span class="eyebrow">TWO SAILORS · ${COURSES[d.stage].name}</span><h1 tabindex="-1">팀 점수 ${(x.score + y.score).toLocaleString()}</h1><div class="duo-scores">${d.names.map((n, i) => `<p><b translate="no">${esc(n)}</b> ${d.scores[i].score.toLocaleString()}점 · 별빛 ${d.scores[i].stars} · HP 손실 ${d.scores[i].hpLoss}회</p>`).join('')}</div><p>${lead}</p><p class="muted">둘이서 달린 기록은 기록·해금에 반영하지 않아요.</p><div class="button-row">${button('duo-again', '같은 둘이 다시', 'primary')}${button('duo', '새로 정하기', 'secondary')}${button('challenges', '특별 항해', 'secondary')}</div></section></div>`;
}
// The second sailor's score line and buttons in the lower half.
export const secondHudMarkup = (name: string) =>
  `<div class="hud hud-two"><div class="hp-block"><span class="hud-caption" translate="no">${esc(name)}</span><strong id="hp2" role="img" aria-label="체력 3"></strong></div><div class="route-progress"><span>W 점프 · S 슬라이드</span><progress id="progress2" max="24000" value="0" aria-label="두 번째 항해사 진행률"></progress><small id="progress-label2">0%</small></div><div class="score-block"><span class="hud-caption">SCORE</span><strong id="score2">0</strong></div></div><div class="touch-controls touch-two"><button data-control="slide2" class="control slide" aria-label="두 번째 항해사 슬라이드, 누르고 유지"><span>⇣</span><b>슬라이드</b><small>S 누르기</small></button><button data-control="jump2" class="control jump" aria-label="두 번째 항해사 점프, 공중에서 다시 누르면 2단 점프"><span>↟</span><b>점프</b><small>W</small></button></div>`;
export function updateSecondHud(root: HTMLElement, r: Runner, setText: (selector: string, text: string) => void) {
  const hp = root.querySelector('#hp2'),
    progress = root.querySelector<HTMLProgressElement>('#progress2');
  if (!hp || !progress) return;
  progress.max = r.length;
  progress.value = Math.min(r.length, r.x);
  // Read by the browser checks: whether this sailor is in the air, so input can be told apart.
  progress.dataset.air = String(!r.grounded);
  setText('#progress-label2', Math.min(100, Math.floor((r.x / r.length) * 100)).toString() + '%');
  const hearts = `<span>${'♥'.repeat(Math.max(0, r.hp))}</span><em>${'♡'.repeat(3 - Math.max(0, r.hp))}</em>`;
  if (hp.innerHTML !== hearts) {
    hp.innerHTML = hearts;
    hp.setAttribute('aria-label', `체력 ${Math.max(0, r.hp)}`);
  }
  setText('#score2', r.points.toLocaleString());
}
