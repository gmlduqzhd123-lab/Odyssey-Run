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
    )}</svg><p class="muted">이번 주 ${weeks.at(-1)!.sailors}명 · 항해한 날 모두 ${weeks.at(-1)!.days}일. 학생 이름을 누르면 한 장 요약을 볼 수 있어요.</p><div class="report-names">${rows.map(r => button('report:' + r.id, esc(r.name), 'secondary', 'translate="no"')).join('')}</div>${rows.length ? button('report-all', `🖨 학생 요약 ${rows.length}장 한꺼번에`, 'secondary') : ''}</section>`;
}
// One student's printable page: islands, discoveries, recent sailing and room for a note.
export function studentSheet(r: SailorProgress, today: string) {
  const s = streaks(r.days, today),
    recent = r.days.filter(d => Date.parse(today) - Date.parse(d) < 28 * 86_400_000).length;
  return `<article class="sheet"><header class="sheet-head"><h1 tabindex="-1"><span>오디세이 런 기록</span> · <span translate="no">${esc(r.name)}</span></h1><p>${today} 기준 · 이 기기에 저장된 기록</p></header><section><h2>섬 완주</h2><ul class="report-islands">${STAGES.map((id, i) => `<li>${r.stages[i].complete ? '⚑' : '○'} ${COURSES[id].name}${r.stages[i].complete ? ` · ${'★'.repeat(r.stages[i].rating)}` : ''}</li>`).join('')}</ul></section><section><h2>모험의 발자취</h2><p>지도 조각 ${r.maps}/${TOTAL_MAPS} · 신화 퀴즈 ${r.quiz}/${QUIZ.length} · 배지 ${r.badges}/${ACHIEVEMENTS.length}</p><p>최근 4주 동안 ${recent}일 항해 · 연속 ${s.current}일 · 최고 연속 ${s.best}일</p></section><section><h2>선생님 한마디</h2><p class="note-lines">&nbsp;</p></section></article>`;
}
export function studentReportMarkup(header: string, r: SailorProgress, today: string) {
  return `<div class="page student-report">${header}<div class="no-print button-row">${button('worksheet-print', '🖨 인쇄하기', 'primary')}${button('progress', '진행 현황으로', 'secondary')}</div>${studentSheet(r, today)}</div>`;
}
// Every student's page at once, one sheet per printed page, for letters home.
export function reportAllMarkup(header: string, rows: SailorProgress[], today: string) {
  return `<div class="page student-report all-reports">${header}<div class="no-print button-row">${button('worksheet-print', `🖨 ${rows.length}명 모두 인쇄하기`, 'primary')}${button('progress', '진행 현황으로', 'secondary')}</div><p class="no-print muted">한 학생이 한 장씩 인쇄돼요.</p>${rows.map(r => studentSheet(r, today)).join('')}</div>`;
}
// Each student's last weeks at a glance: sailing days per week as small bars, islands and quiz,
// and a mark on whoever has not sailed for two weeks or is well behind the class.
export function needsHelp(r: SailorProgress, rows: SailorProgress[], today: string) {
  const t = Date.parse(today + 'T00:00:00Z'),
    lately = r.days.some(d => t - Date.parse(d + 'T00:00:00Z') < 14 * 86_400_000),
    sorted = rows.map(x => x.islands).sort((a, b) => a - b),
    median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  if (r.days.length && !lately) return '2주 동안 항해하지 않았어요';
  if (rows.length >= 3 && r.islands <= median - 2) return '반 친구들보다 섬 진도가 느려요';
  return '';
}
export function trendMarkup(rows: SailorProgress[], today: string) {
  if (!rows.length) return '';
  const lines = rows.map(r => {
    const weeks = weeklyActivity([r], today),
      top = 7,
      bars = weeks
        .map(
          (w, i) =>
            `<rect x="${i * 12 + 1}" y="${28 - (w.days / top) * 26}" width="9" height="${Math.max(1, (w.days / top) * 26)}" rx="2" fill="${w.days ? '#3f7f7a' : '#c9c2a8'}"></rect>`,
        )
        .join(''),
      help = needsHelp(r, rows, today),
      week = weeks.at(-1)!.days;
    return `<tr${help ? ' class="needs-help"' : ''}><th scope="row" translate="no">${esc(r.name)}</th><td><svg class="trend-bars" viewBox="0 0 96 30" role="img" aria-label="최근 ${REPORT_WEEKS}주 주별 항해일 ${weeks.map(w => w.days).join(', ')}">${bars}</svg></td><td>${week}일</td><td>${r.islands}/${STAGES.length}</td><td>${r.quiz}/${QUIZ.length}</td><td>${help ? `⚠ ${help}` : '—'}</td></tr>`;
  });
  const flagged = rows.filter(r => needsHelp(r, rows, today)).length;
  return `<section class="trend"><h2>학생별 흐름 <small>최근 ${REPORT_WEEKS}주</small></h2><p class="muted">막대 하나가 한 주예요(높을수록 그 주에 여러 날 항해). ${flagged ? `살펴볼 학생 ${flagged}명을 표시했어요.` : '모두 꾸준히 항해하고 있어요.'}</p><div class="table-wrap"><table><thead><tr><th scope="col">이름</th><th scope="col">주별 항해</th><th scope="col">이번 주</th><th scope="col">섬</th><th scope="col">퀴즈</th><th scope="col">살펴보기</th></tr></thead><tbody>${lines.join('')}</tbody></table></div></section>`;
}
