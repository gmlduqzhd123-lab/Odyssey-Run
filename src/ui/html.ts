import {assetUrl} from '../assets/catalog';
// Small markup helpers shared by every screen.
export const icon = (name: string, cls = '') => `<img class="icon ${cls}" src="${assetUrl(name)}" alt="">`;
export const esc = (text: string) =>
  text.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
export const button = (action: string, text: string, cls = '', extra = '') =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
