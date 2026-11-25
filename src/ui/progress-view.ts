import {COURSES, STAGES} from '../levels/courses';
import {quizIds} from '../levels/quiz';
import {stampIds} from '../levels/adventure';
import type {progress} from '../storage/profiles';
import {toCsv} from '../systems/scanner';
import {translate} from '../i18n';
import {TOTAL_MAPS} from './book-nav';
import {button, esc} from './html';
import {STRETCHES, hardest, topKind, type Balance} from '../storage/balance';
import {damageName} from '../systems/damage';
import {VARIANT_LABELS} from '../levels/variants';
import type {StageId} from '../levels/courses';
import type {VariantId} from '../levels/course-ids';
// The teacher's view of every sailor on this device: islands, maps, stamps, quiz and last save.
export type SailorProgress = ReturnType<typeof progress> & {id: string; name: string};
const stageCell = (s: SailorProgress['stages'][number]) =>
  s.complete ? `✓ ${'★'.repeat(s.rating)}` : s.score ? `${s.score.toLocaleString()}점` : '—';
export function progressMarkup(header: string, rows: SailorProgress[], version = '', extra = '') {
  const done = rows.filter(r => r.islands === STAGES.length).length;
  return `<div class="page progress">${header}<div class="page-heading"><span class="eyebrow">FOR TEACHERS</span><h1 tabindex="-1">학생별 진행 현황</h1><p>이 기기에 있는 항해사 ${rows.length}명 · 모든 섬 완주 ${done}명. 반 전체 백업을 합쳐 오면 여러 기기의 학생을 한 표로 볼 수 있어요.</p></div><section class="progress-board"><div class="button-row">${button('progress-csv', '진행 현황 CSV 내보내기', 'secondary')}${button('growth', '📈 성장 리포트', 'secondary')}${button('profiles', '항해사 화면으로', 'text-button')}</div><div class="table-scroll" tabindex="0" role="region" aria-label="학생별 진행 현황 표"><table><thead><tr><th scope="col">이름</th>${STAGES.map(id => `<th scope="col">${COURSES[id].name}</th>`).join('')}<th scope="col">지도</th><th scope="col">도장</th><th scope="col">퀴즈</th><th scope="col">총점</th><th scope="col">마지막 저장</th></tr></thead><tbody>${rows
    .map(
      r =>
        `<tr><th scope="row" translate="no">${esc(r.name)}</th>${r.stages.map(s => `<td>${stageCell(s)}</td>`).join('')}<td>${r.maps}/${TOTAL_MAPS}</td><td>${r.stamps}/${stampIds.length}</td><td>${r.quiz}/${quizIds.length}</td><td>${r.total.toLocaleString()}</td><td>${r.saved || '기록 없음'}</td></tr>`,
    )
    .join(
      '',
    )}</tbody></table></div><small>✓ 완주와 최고 별점 · 숫자는 아직 완주 전 최고 점수 · 온라인으로 보내지 않아요.</small>${version ? `<p class="muted">이 기기의 게임 버전: <code translate="no">${esc(version)}</code></p>` : ''}</section>${extra}</div>`;
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
// The course balance board (settings → 📊 코스 균형 통계): per course, the runs, how many were
// finished, the stretch where most HP was lost and its most common cause.
export function balanceMarkup(b: Balance, on: boolean) {
  const rows = Object.entries(b)
    .filter(([key]) => {
      const [stage, variant] = key.split('/');
      return STAGES.includes(stage as StageId) && !!VARIANT_LABELS[stage as StageId]?.[variant as VariantId];
    })
    .sort((x, y) => y[1].runs - x[1].runs);
  if (!rows.length && !on) return '';
  const body = rows
    .map(([key, c]) => {
      const [stage, variant] = key.split('/') as [StageId, VariantId],
        h = hardest(c),
        k = topKind(c),
        bars = c.hits
          .map((n, i) => {
            const top = Math.max(1, ...c.hits),
              height = Math.round((n / top) * 24);
            return `<rect x="${i * 10 + 1}" y="${28 - height}" width="8" height="${height}" rx="1"${i === h ? ' class="peak"' : ''}></rect>`;
          })
          .join('');
      return `<tr><th scope="row">${COURSES[stage].name} · ${VARIANT_LABELS[stage][variant].name}</th><td>${c.runs}</td><td>${c.runs ? Math.round((c.done / c.runs) * 100) : 0}%</td><td><svg class="trend-bars" viewBox="0 0 ${STRETCHES * 10} 30" role="img" aria-label="구간별 HP 손실 ${c.hits.join(', ')}">${bars}</svg></td><td>${h === null ? '—' : `${h * 10}~${h * 10 + 10}%`}</td><td>${k ? damageName(k) : '—'}</td></tr>`;
    })
    .join('');
  return `<section class="balance-board"><h2>📊 코스 균형 통계 (이 기기)</h2><p class="muted"><span>${on ? '섬 항해가 끝날 때마다 더해져요.' : '지금은 모으지 않아요(설정에서 켤 수 있어요).'}</span> <span>코스를 고를 때나 어려운 구간을 미리 알려 줄 때 참고하세요.</span></p>${
    rows.length
      ? `<div class="table-scroll"><table><thead><tr><th scope="col">코스</th><th scope="col">항해</th><th scope="col">완주율</th><th scope="col">구간별 HP 손실</th><th scope="col">가장 어려운 구간</th><th scope="col">가장 많이 부딪힌 것</th></tr></thead><tbody>${body}</tbody></table></div><div class="button-row">${button('balance-csv', '표 CSV 내보내기', 'secondary')}${button('balance-export', '통계 파일 내보내기', 'secondary')}${button('balance-clear', '통계 지우기', 'text-button')}</div>`
      : '<p>아직 모은 항해가 없어요.</p>'
  }<label class="file-pick">다른 기기의 통계 파일 합치기 <input type="file" id="balance-file" accept="application/json,.json"></label><p role="status" id="balance-status"></p></section>`;
}
// The balance board as a spreadsheet (one row per course).
export function balanceCsv(b: Balance) {
  return toCsv([
    [
      '코스',
      '항해',
      '완주',
      ...Array.from({length: STRETCHES}, (_, i) => `HP 손실 ${i * 10}~${i * 10 + 10}%`),
      '가장 많이 부딪힌 것',
    ],
    ...Object.entries(b).map(([key, c]) => {
      const [stage, variant] = key.split('/') as [StageId, VariantId],
        k = topKind(c);
      return [
        COURSES[stage] && VARIANT_LABELS[stage]?.[variant]
          ? `${COURSES[stage].name} · ${VARIANT_LABELS[stage][variant].name}`
          : key,
        c.runs,
        c.done,
        ...c.hits,
        k ? damageName(k) : '',
      ];
    }),
  ]);
}
