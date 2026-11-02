import {CHAPTERS, chapterOpen, type Chapter} from '../levels/chronicle';
import {regionArt} from '../assets/terrain';
import {translate} from '../i18n';
import type {Save} from '../storage/save';
import {button, readButton} from './html';
// The chronicle page (a timeline of chapter cards), one chapter's picture story, and the poster.
export function chronicleMarkup(header: string, save: Save) {
  const open = CHAPTERS.filter(c => chapterOpen(save, c.id)).length;
  return `<div class="page chronicle">${header}<div class="page-heading"><span class="eyebrow">THE ODYSSEY, CHAPTER BY CHAPTER</span><h1 tabindex="-1">오디세이아 연대기</h1><p>섬을 완주할 때마다 이야기 카드가 한 장씩 열려요. ${open} / ${CHAPTERS.length}장</p></div><ol class="chronicle-line">${CHAPTERS.map(
    (c, i) => {
      const on = chapterOpen(save, c.id);
      return `<li class="chapter-card ${on ? 'open' : ''}">${on ? regionArt(c.view, 'chapter-art') : '<span class="chapter-art locked" aria-hidden="true">🔒</span>'}<span class="chapter-number">${i + 1}</span><b>${c.title}</b>${on ? button('scene:' + c.id, '이야기 보기', 'text-button') : '<small>섬을 완주하면 열려요</small>'}</li>`;
    },
  ).join(
    '',
  )}</ol><div class="page-foot">${button('scene:troy', '처음부터 이야기만 보기', 'primary')}${button('chronicle-poster', '🖼 연표 포스터 저장', 'secondary')}</div><p role="status" id="poster-status"></p></div>`;
}
// One picture story: a line at a time, with the next opened chapter after the last line.
export function sceneMarkup(c: Chapter, line: number, next: Chapter | null, back: string) {
  const last = line >= c.lines.length - 1;
  return `<div class="veil"><section class="panel scene-panel"><span class="eyebrow">CHRONICLE · ${line + 1} / ${c.lines.length}</span><h1 tabindex="-1">${c.title}</h1>${regionArt(c.view, 'scene-art scene-step-' + line, c.title)}<p class="read-text scene-line" aria-live="polite">${c.lines[line]}</p>${readButton()}<div class="button-row">${line > 0 ? button(`scene:${c.id}:${line - 1}`, '← 이전', 'secondary') : ''}${last ? (next ? button('scene:' + next.id, '다음 이야기 →', 'primary') : button(back, '이야기 닫기', 'primary')) : button(`scene:${c.id}:${line + 1}`, '다음 →', 'primary')}</div>${button(back, '그만 보기', 'text-button')}</section></div>`;
}
// A 1200×800 timeline poster of every chapter, opened ones with their title in full.
export async function posterBlob(save: Save, name: string) {
  const W = 1200,
    H = 800,
    canvas = document.createElement('canvas'),
    g = canvas.getContext('2d')!,
    font = (w: number, s: number) => `${w} ${s}px "Odyssey UI", system-ui, sans-serif`;
  canvas.width = W;
  canvas.height = H;
  g.fillStyle = '#f4ecd6';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d3b4c';
  g.font = font(800, 46);
  g.fillText(translate('오디세이아 연대기'), 60, 90);
  g.font = font(500, 22);
  g.fillStyle = '#4c6662';
  g.fillText(translate('트로이에서 이타카까지') + (name ? ` · ${name}` : ''), 60, 130);
  // Two columns of four chapters, joined by a line; opened chapters are filled in.
  CHAPTERS.forEach((c, i) => {
    const col = i < 4 ? 0 : 1,
      x = 90 + col * 540,
      y = 220 + (i % 4) * 130,
      on = chapterOpen(save, c.id);
    if (i % 4) {
      g.strokeStyle = '#3f7f7a';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x, y - 130 + 22);
      g.lineTo(x, y - 22);
      g.stroke();
    }
    g.fillStyle = on ? '#3f7f7a' : '#d8cfb6';
    g.beginPath();
    g.arc(x, y, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff8e3';
    g.font = font(800, 22);
    g.textAlign = 'center';
    g.fillText(String(i + 1), x, y + 8);
    g.textAlign = 'left';
    g.fillStyle = on ? '#1d3b4c' : '#9b9480';
    g.font = font(on ? 800 : 500, 28);
    g.fillText(translate(on ? c.title : '???'), x + 44, y + 10, 440);
  });
  g.font = font(500, 20);
  g.fillStyle = '#4c6662';
  g.fillText('gmlduqzhd123-lab.github.io/Odyssey-Run', 60, H - 40);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(Error('png'))), 'image/png'),
  );
}
