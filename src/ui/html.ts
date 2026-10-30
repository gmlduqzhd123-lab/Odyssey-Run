import {assetUrl} from '../assets/catalog';
// Small markup helpers shared by every screen.
// Decorative art as a background, so a picture that cannot load (a flaky classroom connection)
// leaves an empty space instead of the browser's broken-image mark.
export const icon = (name: string, cls = '') =>
  `<span class="icon ${cls}" style="background-image:url('${assetUrl(name)}')" aria-hidden="true"></span>`;
export const esc = (text: string) =>
  text.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!);
export const button = (action: string, text: string, cls = '', extra = '') =>
  `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
export function downloadFile(data: string | Blob, filename: string, type = 'application/json;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
