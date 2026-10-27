import './style.css';
import {App} from './ui/app';
import {initialLang, loadDictionary} from './i18n';
let storage: Storage | null = null;
try {
  storage = localStorage;
} catch {}
// English players wait for the dictionary once; if it cannot load, the game still runs in Korean.
if (initialLang(storage) === 'en') await loadDictionary().catch(() => {});
const app = new App();
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
