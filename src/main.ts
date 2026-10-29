import './style.css';
import {App} from './ui/app';
import {initialLang, loadDictionary} from './i18n';
let storage: Storage | null = null;
try {
  storage = localStorage;
} catch {}
// Players of another language wait for its dictionary once; if it cannot load, the game still
// runs in Korean.
await loadDictionary(initialLang(storage)).catch(() => {});
// Canvas captions are drawn with the bundled font; wait briefly for it so the first ones match.
await Promise.race([document.fonts?.load('16px "Odyssey UI"'), new Promise(r => setTimeout(r, 1200))]).catch(() => {});
const app = new App();
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
