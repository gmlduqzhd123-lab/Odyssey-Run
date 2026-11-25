import {READINGS, readingFor, type Reading} from '../levels/readings';
import {button, readButton} from './html';
// An island's reading page (opened after the island is complete): the passage, two questions and
// a check. Both right marks the reading as read in the sailor's record.
export function readingMarkup(header: string, r: Reading, chosen: (number | null)[] = [], checked = false) {
  const right = r.questions.map((q, i) => chosen[i] === q.answer);
  return `<div class="page reading">${header}<article class="reading-card"><span class="eyebrow">READ AND ANSWER</span><h1 tabindex="-1">📖 ${r.title}</h1><div class="read-text">${r.lines.map(l => `<p>${l}</p>`).join('')}</div>${readButton()}${r.questions
    .map(
      (q, i) =>
        `<fieldset class="reading-q ${checked ? (right[i] ? 'right' : 'wrong') : ''}"><legend>${i + 1}. ${q.question}</legend>${q.options.map((o, k) => `<label><input type="radio" name="reading-${i}" value="${k}" ${chosen[i] === k ? 'checked' : ''}><span>${o}</span></label>`).join('')}${checked ? `<p class="reading-feedback">${right[i] ? '✓ 맞았어요!' : `정답: ${q.options[q.answer]}`}</p>` : ''}</fieldset>`,
    )
    .join(
      '',
    )}<p role="status" id="reading-status">${checked ? (right.every(Boolean) ? '모두 맞혔어요! 수첩에 기록했어요.' : '글을 다시 읽고 한 번 더 해 봐요.') : ''}</p><div class="button-row">${button('reading-check:' + r.id, '답 확인', 'primary')}${button('readings', '다른 섬 읽기', 'secondary')}</div></article></div>`;
}
// The list of readings: open ones for completed islands, the rest waiting.
export function readingListMarkup(header: string, open: (id: string) => boolean, read: readonly string[]) {
  return `<div class="page reading">${header}<div class="page-heading"><span class="eyebrow">ISLAND READINGS</span><h1 tabindex="-1">📖 섬 이야기 읽기</h1><p>섬을 완주하면 그 섬의 짧은 글과 질문이 열려요. 다 읽은 섬 ${read.length}/${READINGS.length}</p></div><ol class="reading-list">${READINGS.map(r => `<li>${read.includes(r.id) ? '✓' : '○'} <b>${r.title}</b> ${open(r.id) ? button('reading:' + r.id, '읽기', 'secondary') : '<small>섬을 완주하면 열려요</small>'}</li>`).join('')}</ol></div>`;
}
export {readingFor};
