import './style.css';
import {App} from './ui/app';
import {initialLang, loadDictionary} from './i18n';
let storage: Storage | null = null;
try {
  storage = localStorage;
} catch {}
// English players wait for the dictionary once; if it cannot load, the game still runs in Korean.
if (initialLang(storage) === 'en') await loadDictionary().catch(() => {});
// Canvas captions are drawn with the bundled font; wait briefly for it so the first ones match.
await Promise.race([document.fonts?.load('16px "Odyssey UI"'), new Promise(r => setTimeout(r, 1200))]).catch(() => {});
const app = new App();
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
