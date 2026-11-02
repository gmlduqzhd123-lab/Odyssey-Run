import {COURSES, STAGES, type StageId} from '../levels/courses';
import {BLOCKS, BLOCK_IDS, MAKER_SLOTS, type BlockId} from '../levels/maker';
import {qrSvg} from '../systems/share';
import {button, esc} from './html';
// Screens for building, sharing and receiving student courses.
export interface MakerDraft {
  stage: StageId;
  blocks: string;
  title: string;
}
export function makerMarkup(header: string, draft: MakerDraft, open: (id: StageId) => boolean, message = '') {
  return `<div class="page maker">${header}<div class="page-heading"><span class="eyebrow">BUILD YOUR OWN VOYAGE</span><h1 tabindex="-1">나만의 코스 만들기</h1><p>열 칸에 블록을 골라 코스를 만들고, 검사를 통과하면 QR로 친구에게 보내요. 기록·해금에는 반영하지 않아요.</p></div><section class="maker-form"><div class="maker-meta"><label>섬 <select id="maker-stage">${STAGES.map(id => `<option value="${id}" ${id === draft.stage ? 'selected' : ''} ${open(id) ? '' : 'disabled'}>${COURSES[id].name}${open(id) ? '' : ' 🔒'}</option>`).join('')}</select></label><label>코스 이름 <input id="maker-title" maxlength="12" autocomplete="off" placeholder="예: 지우의 가시 계곡" value="${esc(draft.title)}"></label></div><ol class="maker-slots">${[
    ...draft.blocks,
  ]
    .map(
      (b, i) =>
        `<li><label><span>${i + 1}번 칸</span><select data-slot="${i}" aria-label="${i + 1}번 칸 블록">${BLOCK_IDS.map(id => `<option value="${id}" ${id === b ? 'selected' : ''}>${BLOCKS[id].name} · ${BLOCKS[id].hint}</option>`).join('')}</select></label></li>`,
    )
    .join(
      '',
    )}</ol><div class="button-row">${button('maker-random', '🎲 무작위로 채우기', 'secondary')}${button('maker-clear', '모두 평지로', 'secondary')}</div><div class="button-row">${button('maker-check', '✓ 끝까지 갈 수 있는지 검사', 'secondary')}${button('maker-run', '달려 보기 →', 'primary')}${button('maker-share', 'QR로 보내기', 'secondary')}</div><p role="status" id="maker-message">${esc(message)}</p><small>모든 코스는 체력을 잃지 않고 끝까지 갈 수 있는지 자동으로 달려 보고 검사해요. 별빛은 칸마다 놓여요.</small></section></div>`;
}
const blockList = (blocks: string) =>
  `<ol class="maker-preview">${[...blocks].map(b => `<li>${BLOCKS[b as BlockId].name}</li>`).join('')}</ol>`;
export function makerShareMarkup(draft: MakerDraft, url: string) {
  return `<div class="veil"><section class="panel share-panel"><span class="eyebrow">SHARE YOUR COURSE</span><h1 tabindex="-1">‘${esc(draft.title || '나만의 코스')}’ 보내기</h1><p>${COURSES[draft.stage].name} · ${MAKER_SLOTS}칸</p>${blockList(draft.blocks)}<div class="qr-box" role="img" aria-label="코스 링크 QR 코드">${qrSvg(url)}</div><p class="muted">친구가 휴대폰 카메라로 찍거나 링크를 열면 이 코스를 달릴 수 있어요. 서버로 보내지 않고 링크 안에만 담겨요.</p><label class="share-url">링크 <input id="share-url" readonly value="${esc(url)}"></label><div class="button-row">${button('share-copy', '링크 복사', 'secondary')}${'share' in navigator ? button('share-native', '휴대폰으로 공유', 'secondary') : ''}</div><p role="status" id="share-status"></p>${button('maker', '코스 만들기로 돌아가기', 'primary')}</section></div>`;
}
export function makerReceivedMarkup(draft: MakerDraft, open: boolean) {
  return `<div class="veil"><section class="panel"><span class="eyebrow">A FRIEND’S COURSE</span><h1 tabindex="-1">‘${esc(draft.title || '나만의 코스')}’ 코스가 도착했어요</h1><p>${COURSES[draft.stage].name} · ${MAKER_SLOTS}칸</p>${blockList(draft.blocks)}<p class="muted">친구가 만든 코스는 기록·해금에 반영하지 않아요. 고쳐서 내 코스로 만들 수도 있어요.</p>${open ? button('maker-run', '이 코스 달리기 →', 'primary large') : `<p class="unlock-hint">${COURSES[draft.stage].name}은 아직 잠겨 있어요. 코스 만들기에서 다른 섬으로 바꿔 달릴 수 있어요.</p>`}<div class="button-row">${button('maker', '고쳐서 내 코스로', 'secondary')}${button('home', '시작 화면으로', 'secondary')}</div></section></div>`;
}
