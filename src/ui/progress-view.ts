import {COURSES, STAGES} from '../levels/courses';
import {QUIZ} from '../levels/quiz';
import {stampIds} from '../levels/adventure';
import type {progress} from '../storage/profiles';
import {toCsv} from '../systems/scanner';
import {translate} from '../i18n';
import {TOTAL_MAPS} from './book-view';
import {button, esc} from './html';
// The teacher's view of every sailor on this device: islands, maps, stamps, quiz and last save.
export type SailorProgress = ReturnType<typeof progress> & {id: string; name: string};
const stageCell = (s: SailorProgress['stages'][number]) =>
  s.complete ? `✓ ${'★'.repeat(s.rating)}` : s.score ? `${s.score.toLocaleString()}점` : '—';
export function progressMarkup(header: string, rows: SailorProgress[]) {
  const done = rows.filter(r => r.islands === STAGES.length).length;
  return `<div class="page progress">${header}<div class="page-heading"><span class="eyebrow">FOR TEACHERS</span><h1 tabindex="-1">학생별 진행 현황</h1><p>이 기기에 있는 항해사 ${rows.length}명 · 모든 섬 완주 ${done}명. 반 전체 백업을 합쳐 오면 여러 기기의 학생을 한 표로 볼 수 있어요.</p></div><section class="progress-board"><div class="button-row">${button('progress-csv', '진행 현황 CSV 내보내기', 'secondary')}${button('profiles', '항해사 화면으로', 'text-button')}</div><div class="table-scroll" tabindex="0" role="region" aria-label="학생별 진행 현황 표"><table><thead><tr><th scope="col">이름</th>${STAGES.map(id => `<th scope="col">${COURSES[id].name}</th>`).join('')}<th scope="col">지도</th><th scope="col">도장</th><th scope="col">퀴즈</th><th scope="col">총점</th><th scope="col">마지막 저장</th></tr></thead><tbody>${rows
    .map(
      r =>
        `<tr><th scope="row" translate="no">${esc(r.name)}</th>${r.stages.map(s => `<td>${stageCell(s)}</td>`).join('')}<td>${r.maps}/${TOTAL_MAPS}</td><td>${r.stamps}/${stampIds.length}</td><td>${r.quiz}/${QUIZ.length}</td><td>${r.total.toLocaleString()}</td><td>${r.saved || '기록 없음'}</td></tr>`,
    )
    .join(
      '',
    )}</tbody></table></div><small>✓ 완주와 최고 별점 · 숫자는 아직 완주 전 최고 점수 · 온라인으로 보내지 않아요.</small></section></div>`;
}
export function progressCsv(rows: SailorProgress[]) {
  return toCsv([
    [
      '이름',
      ...STAGES.flatMap(id => ['완주', '별점', '최고 점수'].map(h => `${COURSES[id].name} · ${h}`)),
      '지도',
      '도장',
      '퀴즈',
      '총점',
      '마지막 저장',
    ].map(h => translate(h)),
    ...rows.map(r => [
      r.name,
      ...r.stages.flatMap(s => [s.complete ? 'O' : 'X', s.rating, s.score]),
      r.maps,
      r.stamps,
      r.quiz,
      r.total,
      r.saved,
    ]),
  ]);
}
