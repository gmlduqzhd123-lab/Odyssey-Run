import type {Lang} from '../i18n';
// Keeps the chosen language's dictionary and letters on the device, so the game stays in that
// language offline even before any island is downloaded. Korean needs nothing and English is in
// the offline core. The service worker reads this cache after its own (public/sw.js).
export const langCacheName = (base: string) => 'odyssey-run-lang:' + base;
export function languageFiles(lang: Lang, loaded: string[], fontUrl: string) {
  if (lang === 'ko' || lang === 'en') return [];
  const chunk = new RegExp(`/assets/${lang}-[^/]+\\.js$`),
    files = loaded.filter(u => chunk.test(new URL(u).pathname));
  // Chinese is drawn with the device font; Vietnamese and Russian use the accented-letter file.
  return lang === 'zh' ? files : [...files, fontUrl];
}
export async function keepLanguage(lang: Lang) {
  if (typeof caches === 'undefined' || typeof performance === 'undefined') return;
  const base = import.meta.env.BASE_URL,
    files = languageFiles(
      lang,
      performance.getEntriesByType('resource').map(e => e.name),
      new URL(base + 'fonts/odyssey-ui-extra.woff2', location.href).href,
    );
  try {
    const cache = await caches.open(langCacheName(base));
    // Another language or an older build: its files are no longer needed.
    for (const req of await cache.keys()) if (!files.includes(req.url)) await cache.delete(req);
    for (const url of files) if (!(await cache.match(url))) await cache.add(url);
  } catch {}
}
