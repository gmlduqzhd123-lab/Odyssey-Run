import {translate} from '../i18n';
import {button, downloadFile} from './html';
// Photo mode (from the pause dialog): the paused course without the HUD, the hero in a chosen
// pose, saved as a picture on this device with the island and the date along the bottom.
export const PHOTO_POSES = [
  ['run', '달리기'],
  ['jump', '점프'],
  ['crouch', '숙이기'],
  ['cheer', '만세'],
] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number][0];
export const photoMarkup = (pose: PhotoPose) =>
  `<div class="photo-ui"><section class="photo-bar" role="group" aria-labelledby="photo-title"><h2 id="photo-title" tabindex="-1">📷 사진 찍기</h2><fieldset aria-label="영웅의 자세">${PHOTO_POSES.map(([id, name]) => `<label><input type="radio" name="photo-pose" value="${id}" ${id === pose ? 'checked' : ''}><span>${name}</span></label>`).join('')}</fieldset>${button('photo-save', '사진 저장', 'primary')}${button('photo-close', '돌아가기', 'secondary')}<p role="status" id="photo-status"></p></section></div>`;
// Two frames first, so the chosen pose is drawn before the picture is taken.
export async function savePhoto(source: HTMLCanvasElement, caption: string, filename: string) {
  try {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = document.createElement('canvas'),
      band = Math.round(source.height * 0.08);
    c.width = source.width;
    c.height = source.height + band;
    const g = c.getContext('2d')!;
    g.drawImage(source, 0, 0);
    g.fillStyle = '#163a4f';
    g.fillRect(0, source.height, c.width, band);
    g.fillStyle = '#f6e8c5';
    g.font = `700 ${Math.round(band * 0.45)}px 'Odyssey UI', sans-serif`;
    g.textBaseline = 'middle';
    g.fillText(translate(caption), band * 0.5, source.height + band / 2);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
    if (!blob) return false;
    downloadFile(blob, filename, 'image/png');
    return true;
  } catch {
    return false;
  }
}
