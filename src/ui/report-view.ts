import {COURSES, STAGES} from '../levels/courses';
import {QUIZ} from '../levels/quiz';
import {ACHIEVEMENTS, streaks, weekKey} from '../storage/feats';
import {TOTAL_MAPS} from './book-view';
import {button, esc} from './html';
import type {SailorProgress} from './progress-view';
// Learning over time for the teacher: how many sailors sailed in each of the last weeks, and a
// one-page summary per student to print or attach to a letter home.
export const REPORT_WEEKS = 8;
// The last weeks up to today's, oldest first: each with its sailors and sailing days.
export function weeklyActivity(rows: SailorProgress[], today: string, weeks = REPORT_WEEKS) {
  const keys: string[] = [],
    t = Date.parse(today + 'T00:00:00Z');
  for (let i = weeks - 1; i >= 0; i--) keys.push(weekKey(new Date(t - i * 7 * 86_400_000).toISOString().slice(0, 10)));
  return keys.map(week => {
    const counts = rows.map(r => r.days.filter(d => weekKey(d) === week).length);
    return {week, sailors: counts.filter(Boolean).length, days: counts.reduce((a, b) => a + b, 0)};
  });
}
export function activityMarkup(rows: SailorProgress[], today: string) {
  const weeks = weeklyActivity(rows, today),
    top = Math.max(1, ...weeks.map(w => w.sailors)),
    bar = 160 / top;
  return `<section class="activity"><h2>최근 ${REPORT_WEEKS}주 항해 <small>주마다 항해한 항해사 수</small></h2><svg class="activity-chart" viewBox="0 0 ${weeks.length * 70} 200" role="img" aria-label="주별 항해한 항해사 수">${weeks
    .map(
      (w, i) =>
        `<g><rect x="${i * 70 + 14}" y="${170 - w.sailors * bar}" width="42" height="${w.sailors * bar}" rx="4" fill="#3f7f7a"></rect><text x="${i * 70 + 35}" y="${164 - w.sailors * bar}" text-anchor="middle" font-size="14">${w.sailors}</text><text x="${i * 70 + 35}" y="192" text-anchor="middle" font-size="11">${w.week.slice(5)}</text></g>`,
    )
    .join(
      '',
    )}</svg><p class="muted">이번 주 ${weeks.at(-1)!.sailors}명 · 항해한 날 모두 ${weeks.at(-1)!.days}일. 학생 이름을 누르면 한 장 요약을 볼 수 있어요.</p><div class="report-names">${rows.map(r => button('report:' + r.id, esc(r.name), 'secondary', 'translate="no"')).join('')}</div></section>`;
}
export function studentReportMarkup(header: string, r: SailorProgress, today: string) {
  const s = streaks(r.days, today),
    recent = r.days.filter(d => Date.parse(today) - Date.parse(d) < 28 * 86_400_000).length;
  return `<div class="page student-report">${header}<div class="no-print button-row">${button('worksheet-print', '🖨 인쇄하기', 'primary')}${button('progress', '진행 현황으로', 'secondary')}</div><article class="sheet"><header class="sheet-head"><h1 tabindex="-1">‘<span translate="no">${esc(r.name)}</span>’의 오디세이 런 기록</h1><p>${today} 기준 · 이 기기에 저장된 기록</p></header><section><h2>섬 완주</h2><ul class="report-islands">${STAGES.map((id, i) => `<li>${r.stages[i].complete ? '⚑' : '○'} ${COURSES[id].name}${r.stages[i].complete ? ` · ${'★'.repeat(r.stages[i].rating)}` : ''}</li>`).join('')}</ul></section><section><h2>모험의 발자취</h2><p>지도 조각 ${r.maps}/${TOTAL_MAPS} · 신화 퀴즈 ${r.quiz}/${QUIZ.length} · 배지 ${r.badges}/${ACHIEVEMENTS.length}</p><p>최근 4주 동안 ${recent}일 항해 · 연속 ${s.current}일 · 최고 연속 ${s.best}일</p></section><section><h2>선생님 한마디</h2><p class="note-lines">&nbsp;</p></section></article></div>`;
}
