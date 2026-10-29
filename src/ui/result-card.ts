import {REGIONS, sheetUrl} from '../assets/terrain';
import {translate} from '../i18n';
// The result card a student saves as a picture for a class board or a message: the island's
// painting, the course, the score and stars, and the sailor's name only when they choose it.
export interface CardInfo {
  view: keyof typeof REGIONS;
  course: string;
  score: number;
  rating: number;
  stars: number;
  maps: number;
  complete: boolean;
  name?: string;
}
export const CARD = {width: 1200, height: 630};
export function cardLines(c: CardInfo) {
  return {
    title: translate('오디세이 런: 이타카로!'),
    course: translate(c.course),
    headline: translate(c.complete ? '섬 완주!' : '다시, 한 걸음 더!'),
    score: translate(`${c.score.toLocaleString()}점`),
    rating: '★'.repeat(c.rating) + '☆'.repeat(3 - c.rating),
    details: translate(`별빛 ${c.stars} · 지도 ${c.maps}/3`),
    name: c.name?.trim() ?? '',
    site: 'gmlduqzhd123-lab.github.io/Odyssey-Run',
  };
}
const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error('art'));
    img.src = src;
  });
export async function resultCard(c: CardInfo): Promise<Blob> {
  const {width: W, height: H} = CARD,
    canvas = document.createElement('canvas'),
    g = canvas.getContext('2d')!,
    t = cardLines(c),
    font = (weight: number, size: number) => `${weight} ${size}px "Odyssey UI", system-ui, sans-serif`;
  canvas.width = W;
  canvas.height = H;
  g.fillStyle = '#102f46';
  g.fillRect(0, 0, W, H);
  // The painting fills the card (cropped to cover), the lower part darkens for the text.
  const r = REGIONS[c.view];
  try {
    const sheet = await load(sheetUrl(r.sheet)),
      scale = Math.max(W / r.w, H / r.h),
      sw = W / scale,
      sh = H / scale;
    g.drawImage(sheet, r.x + (r.w - sw) / 2, r.y + (r.h - sh) / 2, sw, sh, 0, 0, W, H);
  } catch {}
  const shade = g.createLinearGradient(0, H * 0.25, 0, H);
  shade.addColorStop(0, 'rgba(10, 28, 40, 0)');
  shade.addColorStop(1, 'rgba(10, 28, 40, 0.9)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(16, 47, 70, 0.78)';
  g.fillRect(0, 0, W, 76);
  g.textBaseline = 'middle';
  g.fillStyle = '#f6ecd2';
  g.font = font(800, 34);
  g.fillText(t.title, 48, 39);
  g.textAlign = 'right';
  g.font = font(600, 26);
  g.fillText(t.course, W - 48, 39, W / 2);
  g.textAlign = 'left';
  g.shadowColor = 'rgba(0, 0, 0, 0.55)';
  g.shadowBlur = 12;
  g.font = font(800, 46);
  g.fillText(t.headline, 48, H - 250, W - 96);
  g.font = font(800, 120);
  g.fillStyle = '#ffffff';
  g.fillText(t.score, 48, H - 150, W - 380);
  g.font = font(700, 64);
  g.fillStyle = '#ffd36b';
  g.textAlign = 'right';
  g.fillText(t.rating, W - 48, H - 150);
  g.textAlign = 'left';
  g.fillStyle = '#f6ecd2';
  g.font = font(600, 32);
  g.fillText(t.name ? `${t.details} · ${t.name}` : t.details, 48, H - 70, W - 520);
  g.textAlign = 'right';
  g.font = font(500, 24);
  g.fillText(t.site, W - 48, H - 70);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(Error('png'))), 'image/png'));
}
