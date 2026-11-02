import {COURSES} from '../levels/courses';
import {BLOCKS, type BlockId} from '../levels/maker';
import type {GalleryCourse} from '../storage/gallery';
import {button, esc} from './html';
// The teacher's gallery of student courses: votes, try a course, or open a contest on it.
export function galleryMarkup(header: string, list: (GalleryCourse & {index: number})[], message = '') {
  return `<div class="page gallery">${header}<div class="page-heading"><span class="eyebrow">OUR CLASS COURSES</span><h1 tabindex="-1">반 코스 갤러리</h1><p>학생들이 보낸 코스를 모아 손을 들어 투표하고, 뽑힌 코스로 대회를 열어요. 이 기기에만 저장해요.</p></div><section class="maker-form"><label>코스 링크 붙여넣기 <input id="gallery-code" autocomplete="off" placeholder="학생의 코스 링크"></label>${button('gallery-paste', '갤러리에 담기', 'secondary')}<p role="status" id="gallery-message">${esc(message)}</p></section>${
    list.length
      ? `<ol class="gallery-list">${list
          .map(
            (c, rank) =>
              `<li class="gallery-card"><span class="rank">${rank + 1}</span><div><b translate="no">${esc(c.title)}</b><small>${COURSES[c.stage].name}</small><ol class="maker-preview">${[...c.blocks].map(b => `<li>${BLOCKS[b as BlockId].name}</li>`).join('')}</ol></div><div class="gallery-votes"><span aria-label="투표 ${c.votes}표">👍 ${c.votes}</span>${button('gallery-up:' + c.index, '+1', 'secondary', 'aria-label="한 표 더하기"')}${button('gallery-down:' + c.index, '−1', 'text-button', 'aria-label="한 표 빼기"')}</div><div class="button-row">${button('gallery-run:' + c.index, '달려 보기', 'secondary')}${button('gallery-contest:' + c.index, '이 코스로 대회 열기', 'primary')}${button('gallery-remove:' + c.index, '지우기', 'text-button danger')}</div></li>`,
          )
          .join('')}</ol>`
      : '<p class="muted gallery-empty">아직 담긴 코스가 없어요. 학생이 「QR로 보내기」한 링크를 붙여 넣거나, 받은 코스 화면에서 「반 갤러리에 담기」를 눌러 주세요.</p>'
  }</div>`;
}
