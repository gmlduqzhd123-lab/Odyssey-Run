import {STAGES} from '../levels/courses';
import {button} from './html';
// The book's tabs and the number of map fragments (used by pages that are always loaded).
export const TOTAL_MAPS = STAGES.length * 3;
export function bookNav(active: string) {
  return `<nav class="book-nav" aria-label="도감 종류">${[
    ['codex', '지도 조각'],
    ['journal', '모험 수첩'],
    ['harbor', '이타카 항구'],
    ['people', '여정의 인물'],
    ['relics', '아이템과 상징'],
    ['bestiary', '몬스터'],
    ['landscapes', '풍경과 원화'],
  ]
    .map(([id, label]) => button(id, label, 'book-tab', active === id ? 'aria-current="page"' : ''))
    .join('')}</nav>`;
}
