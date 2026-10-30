import {qrSvg} from '../systems/share';
import {button, downloadFile, esc} from './html';
import {resultCard, type CardInfo} from './result-card';
// The share screen after a run: the comparison link and QR, copying or sending it, and saving
// the result as a picture.
export const shareMarkup = (course: string, score: number, name: string, url: string) =>
  `<div class="veil"><section class="panel share-panel"><span class="eyebrow">SHARE YOUR VOYAGE</span><h1 tabindex="-1">친구에게 기록 보내기</h1><p>${course} · ${score.toLocaleString()}점 · ${esc(name)}</p><div class="qr-box" role="img" aria-label="기록 링크 QR 코드">${qrSvg(url)}</div><p class="muted">친구가 휴대폰 카메라로 찍거나 링크를 열면 이 기록과 겨룰 수 있어요. 서버로 보내지 않고 링크 안에만 담겨요.</p><label class="share-url">링크 <input id="share-url" readonly value="${esc(url)}"></label><div class="button-row">${button('share-copy', '링크 복사', 'secondary')}${'share' in navigator ? button('share-native', '휴대폰으로 공유', 'secondary') : ''}${button('share-image', '🖼 그림으로 저장', 'secondary')}</div><label class="toggle card-name"><span>그림에 내 이름 넣기</span><input type="checkbox" id="card-name"><i aria-hidden="true"></i></label><p role="status" id="share-status"></p><div class="button-row">${button('restart', '재도전', 'primary')}${button('islands', '섬 선택', 'secondary')}</div></section></div>`;
export async function saveResultPicture(ui: HTMLElement, card: CardInfo) {
  const status = ui.querySelector('#share-status');
  if (!status) return;
  status.textContent = '그림을 만들고 있어요…';
  try {
    const blob = await resultCard(card),
      name = `odyssey-run-${card.view.replace('view-', '')}-${card.score}.png`,
      file = new File([blob], name, {type: 'image/png'});
    // Phones (iPhone Safari above all) save a picture to the photo library only through the
    // share sheet; a download there opens the picture in a tab instead.
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({files: [file]})) {
      status.textContent = '공유 창에서 「이미지 저장」을 고르면 사진에 저장돼요.';
      try {
        await navigator.share({files: [file], title: '오디세이 런 기록'});
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    downloadFile(blob, name, 'image/png');
    status.textContent = '그림을 저장했어요. 학급 게시판이나 메시지에 올릴 수 있어요.';
  } catch {
    status.textContent = '그림을 만들지 못했어요. 화면을 캡처해 주세요.';
  }
}
export async function shareLink(ui: HTMLElement, kind: 'copy' | 'native') {
  const url = ui.querySelector<HTMLInputElement>('#share-url')?.value,
    status = ui.querySelector('#share-status');
  if (!url || !status) return;
  try {
    if (kind === 'copy') {
      await navigator.clipboard.writeText(url);
      status.textContent = '링크를 복사했어요.';
    } else {
      await navigator.share({title: '오디세이 런 기록', text: '내 기록과 겨뤄 볼래?', url});
      status.textContent = '';
    }
  } catch {
    if (kind === 'copy') {
      ui.querySelector<HTMLInputElement>('#share-url')?.select();
      status.textContent = '자동 복사가 막혔어요. 선택된 링크를 직접 복사해 주세요.';
    }
  }
}
