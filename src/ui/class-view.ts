import {COURSES, MAP_STORIES, STAGES} from '../levels/courses';
import {QUIZ, QUIZ_READ} from '../levels/quiz-text';
import {PEOPLE} from '../assets/catalog';
import {toCsv} from '../systems/scanner';
import {translate} from '../i18n';
import {button, esc} from './html';
import type {SailorProgress} from './progress-view';
// Two class-wide views for the teacher: the class fleet (everyone's starlight sails one ship
// toward Ithaca) and how the class answered each quiz question.
export const FLEET_STEPS = [...STAGES.map(id => COURSES[id].name), '이타카'];
// A reachable default: about three islands' worth of starlight per sailor.
export const defaultFleetGoal = (sailors: number) => Math.max(100, sailors * 150);
export function fleetMarkup(stars: number, goal: number, sailors: number) {
  const share = Math.min(1, stars / Math.max(1, goal)),
    reached = Math.min(FLEET_STEPS.length - 1, Math.floor(share * (FLEET_STEPS.length - 1) + 1e-9));
  return `<section class="fleet"><h2>⛵ 우리 반 함대 <small>항해사 ${sailors}명이 함께 노를 저어요</small></h2><div class="fleet-route" role="img" aria-label="함대 진행 ${Math.round(share * 100)}%"><span class="fleet-line"><i style="width:${share * 100}%"></i></span><span class="fleet-ship" style="left:${share * 100}%">⛵</span>${FLEET_STEPS.map(
    (name, i) => {
      const left = (i / (FLEET_STEPS.length - 1)) * 100,
        edge = i === 0 ? 'first' : i === FLEET_STEPS.length - 1 ? 'last' : '';
      return `<span class="fleet-stop ${i <= reached ? 'passed' : ''}" style="left:${left}%"></span><b class="fleet-label ${edge} ${i % 2 ? 'low' : ''}" style="left:${left}%">${name}</b>`;
    },
  ).join(
    '',
  )}</div><p><b>별빛 ${stars.toLocaleString()} / ${goal.toLocaleString()}</b> · <span>${share >= 1 ? '⚑ 함대가 이타카에 도착했어요!' : `지금 ${FLEET_STEPS[reached]} 근처 · 이타카까지 ${Math.round((1 - share) * 100)}%`}</span></p><p class="muted">각 항해사가 섬마다 모은 최고 별빛을 모두 더해요. 목표는 선생님이 정해요.</p><label class="fleet-goal">함대 목표 별빛 <input id="fleet-goal" type="number" inputmode="numeric" min="50" max="100000" step="50" value="${goal}"></label>${button('fleet-goal', '목표 바꾸기', 'secondary')}</section>`;
}
// The class's wooden horse: one plank for each share of this week's finished runs, the whole
// class together. Everyone builds it; nobody can lose a plank. It starts again each Monday.
export const HORSE = ['....##', '#####.', '####..', '#..#..'];
export const HORSE_PIECES = HORSE.join('').split('#').length - 1;
// A week's goal: three finished runs a sailor (at least one plank a run for a small class).
export const horseGoal = (sailors: number) => Math.max(HORSE_PIECES, sailors * 3);
export function horseMarkup(runs: number, sailors: number) {
  const goal = horseGoal(sailors),
    built = Math.min(HORSE_PIECES, Math.floor((runs / goal) * HORSE_PIECES + 1e-9));
  let k = 0;
  const cells = HORSE.flatMap(row =>
    [...row].map(c => (c === '#' ? `<i class="${k++ < built ? 'built' : ''}"></i>` : '<i class="air"></i>')),
  ).join('');
  return `<section class="horse"><h2>🐴 이번 주 트로이 목마 <small>반 모두의 완주가 널빤지가 돼요</small></h2><div class="horse-grid" role="img" aria-label="목마 ${built}/${HORSE_PIECES}조각">${cells}</div><p><b>완주 ${runs.toLocaleString()} / ${goal.toLocaleString()}</b> <span>${built >= HORSE_PIECES ? '⚑ 목마 완성! 트로이 성문이 열렸어요' : `널빤지 ${built}/${HORSE_PIECES}`}</span></p><p class="muted">이 기기의 항해사들이 이번 주(월요일부터)에 섬을 완주한 횟수를 모두 더해요. 반 전체 백업을 가져오면 다른 기기의 항해도 합쳐져요.</p></section>`;
}
// The class's live mission on the shared board: a few minutes to gather starlight together. The
// teacher starts it; every sailor's starlight from then on counts (kept on this device).
export interface LiveMission {
  start: number;
  minutes: number;
  goal: number;
  base: number;
  // Team race: each team's starlight when the mission started (absent for the whole class together).
  teams?: Partial<Record<Team, number>>;
}
export {TEAMS, readTeams, type Team} from '../storage/class-device';
import {TEAMS, type Team} from '../storage/class-device';
export const TEAM_NAMES: Record<Team, string> = {
  A: '🔴 바람 모둠',
  B: '🔵 파도 모둠',
  C: '🟢 올리브 모둠',
  D: '🟡 태양 모둠',
};
// Each team's starlight now (sailors without a team are left out).
export function teamStars(rows: {id: string; stars: number}[], teams: Record<string, Team>) {
  const out: Partial<Record<Team, number>> = {};
  for (const r of rows) {
    const t = teams[r.id];
    if (t) out[t] = (out[t] ?? 0) + r.stars;
  }
  return out;
}
export const LIVE_MINUTES = [5, 10, 15, 20];
export function readLive(raw: string | null): LiveMission | null {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (
      v &&
      Number.isFinite(v.start) &&
      LIVE_MINUTES.includes(v.minutes) &&
      Number.isSafeInteger(v.goal) &&
      v.goal >= 10 &&
      v.goal <= 100_000 &&
      Number.isSafeInteger(v.base) &&
      v.base >= 0
    ) {
      const teams =
        v.teams && typeof v.teams === 'object'
          ? Object.fromEntries(
              Object.entries(v.teams).filter(
                ([t, n]) => TEAMS.includes(t as Team) && Number.isSafeInteger(n) && (n as number) >= 0,
              ),
            )
          : null;
      return {
        start: v.start,
        minutes: v.minutes,
        goal: v.goal,
        base: v.base,
        ...(teams && Object.keys(teams).length >= 2 ? {teams: teams as Partial<Record<Team, number>>} : {}),
      };
    }
  } catch {}
  return null;
}
export const liveLeft = (m: LiveMission, now: number) => Math.max(0, m.start + m.minutes * 60_000 - now);
export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export interface LiveTeams {
  sailors: {id: string; name: string}[];
  teams: Record<string, Team>;
  // Each team's starlight now.
  now: Partial<Record<Team, number>>;
}
export function liveMarkup(m: LiveMission | null, stars: number, sailors: number, now: number, t?: LiveTeams) {
  if (!m) {
    const picker = t?.sailors.length
      ? `<details class="team-picker"><summary>모둠 나누기 (모둠 대항으로 하려면)</summary><ul>${t.sailors
          .map(
            s =>
              `<li><span translate="no">${esc(s.name)}</span><select data-team="${esc(s.id)}" aria-label="‘${esc(s.name)}’ 모둠"><option value="">모둠 없음</option>${TEAMS.map(k => `<option value="${k}" ${t.teams[s.id] === k ? 'selected' : ''}>${TEAM_NAMES[k]}</option>`).join('')}</select></li>`,
          )
          .join('')}</ul><small>두 모둠 이상에 항해사가 있으면 모둠 대항 미션이 돼요.</small></details>`
      : '';
    return `<section class="live-mission"><h2>⏱ 반 실시간 미션 <small>전자칠판에 띄워 두고 차례로 달려요</small></h2><div class="live-form"><label>시간 <select id="live-minutes">${LIVE_MINUTES.map(n => `<option value="${n}" ${n === 10 ? 'selected' : ''}>${n}분</option>`).join('')}</select></label><label>목표 별빛 <input id="live-goal" type="number" inputmode="numeric" min="10" max="100000" step="10" value="${Math.max(50, sailors * 40)}"></label>${button('live-start', '미션 시작', 'primary')}</div>${picker}<p class="muted">시작한 뒤 이 기기의 항해사들이 모은 별빛을 모두 더해요.</p></section>`;
  }
  const got = Math.max(0, stars - m.base),
    left = liveLeft(m, now),
    share = Math.min(1, got / m.goal),
    done = got >= m.goal;
  // Team race: one bar per team; the first team to the goal wins (or the most starlight at the end).
  if (m.teams && t) {
    const teams = (Object.keys(m.teams) as Team[]).map(k => ({
        k,
        got: Math.max(0, (t.now[k] ?? 0) - (m.teams![k] ?? 0)),
      })),
      top = Math.max(...teams.map(x => x.got)),
      winner = teams.find(x => x.got >= m.goal) ?? (!left && top > 0 ? teams.find(x => x.got === top) : undefined);
    return `<section class="live-mission"><h2>⏱ 모둠 대항 미션 <small>${m.minutes}분 · 모둠마다 목표 별빛 ${m.goal.toLocaleString()}</small></h2><p class="live-count"><span id="live-time" role="timer">${left ? '남은 시간 ' + clock(left) : '시간 종료'}</span></p><ul class="team-race">${teams
      .map(
        x =>
          `<li><b>${TEAM_NAMES[x.k]}</b><span class="fleet-line" role="img" aria-label="${TEAM_NAMES[x.k]} ${Math.round(Math.min(1, x.got / m.goal) * 100)}%"><i style="width:${Math.min(1, x.got / m.goal) * 100}%"></i></span><span>별빛 ${x.got.toLocaleString()}</span></li>`,
      )
      .join(
        '',
      )}</ul><p>${winner ? `⚑ ${TEAM_NAMES[winner.k]} 승리!` : left ? '모둠원이 차례로 달려 별빛을 모아요' : '아쉬워요! 아무 모둠도 별빛을 모으지 못했어요'}</p>${button('live-stop', left && !winner ? '미션 그만두기' : '미션 닫기', 'secondary')}</section>`;
  }
  return `<section class="live-mission"><h2>⏱ 반 실시간 미션 <small>${m.minutes}분 · 목표 별빛 ${m.goal.toLocaleString()}</small></h2><p class="live-count"><b>별빛 ${got.toLocaleString()} / ${m.goal.toLocaleString()}</b> <span id="live-time" role="timer">${left ? '남은 시간 ' + clock(left) : '시간 종료'}</span></p><span class="fleet-line" role="img" aria-label="미션 진행 ${Math.round(share * 100)}%"><i style="width:${share * 100}%"></i></span><p>${done ? '⚑ 미션 성공! 모두 함께 해냈어요' : left ? '한 명씩 달려서 별빛을 모아요' : '아쉬워요! 다음엔 목표를 조금 낮춰 봐요'}</p>${button('live-stop', left && !done ? '미션 그만두기' : '미션 닫기', 'secondary')}</section>`;
}
export interface QuestionReport {
  id: string;
  question: string;
  answered: number;
  right: number;
  // The wrong option chosen most often, if any wrong answers were given.
  wrong: string | null;
  read: string;
}
export function quizReport(rows: SailorProgress[]): QuestionReport[] {
  return QUIZ.map(q => {
    const picks = [0, 1, 2].map(i => rows.reduce((n, r) => n + (r.picks[q.id]?.[i] ?? 0), 0)),
      answered = picks.reduce((a, b) => a + b, 0),
      wrongIndex = [0, 1, 2].filter(i => i !== q.answer).sort((a, b) => picks[b] - picks[a])[0],
      read = QUIZ_READ[q.id];
    return {
      id: q.id,
      question: q.question,
      answered,
      right: picks[q.answer],
      wrong: picks[wrongIndex] ? q.options[wrongIndex] : null,
      read:
        read && 'story' in read
          ? `지도 조각 ${String(read.story + 1).padStart(2, '0')} 「${MAP_STORIES[read.story][0]}」`
          : read
            ? `인물 도감 「${PEOPLE.find(p => p.id === read.person)?.name ?? read.person}」`
            : '',
    };
  });
}
const rate = (r: QuestionReport) => (r.answered ? r.right / r.answered : 1);
export function quizReportMarkup(rows: SailorProgress[]) {
  const report = quizReport(rows),
    answered = report.filter(r => r.answered),
    weak = [...answered].sort((a, b) => rate(a) - rate(b)).filter(r => rate(r) < 0.6);
  return `<section class="quiz-report"><h2>신화 퀴즈 문항별 분석 <small>이 기기의 항해사 모두</small></h2>${
    answered.length
      ? `${
          weak.length
            ? `<p class="weak-note"><b>다시 읽어 보면 좋은 이야기</b> ${weak
                .slice(0, 3)
                .filter(r => r.read)
                .map(r => `<span>${r.read}</span>`)
                .join(' · ')}</p>`
            : '<p class="muted">모든 문항의 정답률이 60% 이상이에요.</p>'
        }<div class="table-scroll" tabindex="0" role="region" aria-label="문항별 정답률 표"><table><thead><tr><th scope="col">문항</th><th scope="col">답한 횟수</th><th scope="col">정답률</th><th scope="col">많이 고른 오답</th><th scope="col">다시 읽기</th></tr></thead><tbody>${report
          .map(
            r =>
              `<tr class="${r.answered && rate(r) < 0.6 ? 'weak' : ''}"><th scope="row">${r.question}</th><td>${r.answered}</td><td>${r.answered ? Math.round(rate(r) * 100) + '%' : '—'}</td><td>${r.wrong ?? '—'}</td><td>${r.read}</td></tr>`,
          )
          .join(
            '',
          )}</tbody></table></div><div class="button-row">${button('quiz-csv', '문항별 분석 CSV 내보내기', 'secondary')}${button('worksheet', '🖨 복습 활동지 만들기', 'secondary')}</div>`
      : `<p class="muted">아직 퀴즈에 답한 항해사가 없어요. 결과 화면이나 모험 수첩에서 퀴즈를 풀 수 있어요.</p>${button('worksheet', '🖨 활동지 만들기', 'secondary')}`
  }<small>정답률 60% 미만 문항은 강조해요. 처음 고른 답뿐 아니라 다시 푼 답도 모두 세요.</small></section>`;
}
export function quizReportCsv(rows: SailorProgress[]) {
  return toCsv([
    ['문항', '답한 횟수', '정답 횟수', '정답률', '많이 고른 오답', '다시 읽기'].map(h => translate(h)),
    ...quizReport(rows).map(r => [
      translate(r.question),
      r.answered,
      r.right,
      r.answered ? Math.round(rate(r) * 100) + '%' : '',
      r.wrong ? translate(r.wrong) : '',
      translate(r.read),
    ]),
  ]);
}
