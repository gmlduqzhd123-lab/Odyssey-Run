import {COURSES, MAP_STORIES, STAGES} from '../levels/courses';
import {QUIZ, QUIZ_READ} from '../levels/quiz';
import {PEOPLE} from '../assets/catalog';
import {toCsv} from '../systems/scanner';
import {translate} from '../i18n';
import {button} from './html';
import type {SailorProgress} from './progress-view';
// Two class-wide views for the teacher: the class fleet (everyone's starlight sails one ship
// toward Ithaca) and how the class answered each quiz question.
export const FLEET_STEPS = [...STAGES.map(id => COURSES[id].name), '이타카'];
// A reachable default: about three islands' worth of starlight per sailor.
export const defaultFleetGoal = (sailors: number) => Math.max(100, sailors * 150);
export function fleetMarkup(stars: number, goal: number, sailors: number) {
  const share = Math.min(1, stars / Math.max(1, goal)),
    reached = Math.min(FLEET_STEPS.length - 1, Math.floor(share * (FLEET_STEPS.length - 1) + 1e-9));
  return `<section class="fleet"><h2>⛵ 우리 반 함대 <small>항해사 ${sailors}명이 함께 노를 저어요</small></h2><div class="fleet-route" role="img" aria-label="함대 진행 ${Math.round(share * 100)}%"><span class="fleet-line"><i style="width:${share * 100}%"></i></span><span class="fleet-ship" style="left:${share * 100}%">⛵</span>${FLEET_STEPS.map((name, i) => `<span class="fleet-stop ${i <= reached ? 'passed' : ''}" style="left:${(i / (FLEET_STEPS.length - 1)) * 100}%"><b>${name}</b></span>`).join('')}</div><p><b>별빛 ${stars.toLocaleString()} / ${goal.toLocaleString()}</b> · ${share >= 1 ? '⚑ 함대가 이타카에 도착했어요!' : `지금 ${FLEET_STEPS[reached]} 근처 · 이타카까지 ${Math.round((1 - share) * 100)}%`}</p><p class="muted">각 항해사가 섬마다 모은 최고 별빛을 모두 더해요. 목표는 선생님이 정해요.</p><label class="fleet-goal">함대 목표 별빛 <input id="fleet-goal" type="number" inputmode="numeric" min="50" max="100000" step="50" value="${goal}"></label>${button('fleet-goal', '목표 바꾸기', 'secondary')}</section>`;
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
                .map(r => r.read)
                .filter(Boolean)
                .join(' · ')}</p>`
            : '<p class="muted">모든 문항의 정답률이 60% 이상이에요.</p>'
        }<div class="table-scroll" tabindex="0" role="region" aria-label="문항별 정답률 표"><table><thead><tr><th scope="col">문항</th><th scope="col">답한 횟수</th><th scope="col">정답률</th><th scope="col">많이 고른 오답</th><th scope="col">다시 읽기</th></tr></thead><tbody>${report
          .map(
            r =>
              `<tr class="${r.answered && rate(r) < 0.6 ? 'weak' : ''}"><th scope="row">${r.question}</th><td>${r.answered}</td><td>${r.answered ? Math.round(rate(r) * 100) + '%' : '—'}</td><td>${r.wrong ?? '—'}</td><td>${r.read}</td></tr>`,
          )
          .join('')}</tbody></table></div>${button('quiz-csv', '문항별 분석 CSV 내보내기', 'secondary')}`
      : '<p class="muted">아직 퀴즈에 답한 항해사가 없어요. 결과 화면이나 모험 수첩에서 퀴즈를 풀 수 있어요.</p>'
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
