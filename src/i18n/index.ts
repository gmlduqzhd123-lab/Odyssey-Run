// The game is written in Korean. Other languages translate text where it is shown: screen DOM
// text and labels (via an observer) and canvas captions (callers use translate). Dictionary keys
// are the Korean text with {x} for anything interpolated; captured parts are translated recursively.
export type Lang = 'ko' | 'en' | 'vi' | 'zh' | 'ru';
// Each language names itself, so anyone can find their own in the list.
export const LANGS: {id: Lang; name: string; html: string; short: string}[] = [
  {id: 'ko', name: '한국어', html: 'ko', short: 'KO'},
  {id: 'en', name: 'English', html: 'en', short: 'EN'},
  {id: 'vi', name: 'Tiếng Việt', html: 'vi', short: 'VI'},
  {id: 'zh', name: '中文', html: 'zh-Hans', short: 'ZH'},
  {id: 'ru', name: 'Русский', html: 'ru', short: 'RU'},
];
const isLang = (v: unknown): v is Lang => LANGS.some(l => l.id === v);
const HANGUL = /[가-힣]/;
// Runs of spaces, including &nbsp;, compare as one space.
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
// Each dictionary is a separate chunk: Korean players never download one.
let EN: Record<string, string> = {};
let loaded = false;
let lang: Lang = 'ko';
export const getLang = () => lang;
const LANG_KEY = 'odyssey-run:lang';
export function initialLang(storage: Pick<Storage, 'getItem'> | null): Lang {
  try {
    const saved = storage?.getItem(LANG_KEY);
    if (isLang(saved)) return saved;
  } catch {}
  // Korean unless chosen: many Korean classrooms run browsers set to English.
  return 'ko';
}
export function setLang(next: Lang, storage?: Pick<Storage, 'setItem'> | null) {
  lang = next;
  try {
    storage?.setItem(LANG_KEY, next);
  } catch {}
  if (typeof document !== 'undefined') document.documentElement.lang = LANGS.find(l => l.id === next)!.html;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// {x} captures any text (translated recursively); {n} captures a number such as 4,130.
const SLOT = /\{[xn]\}/g;
let patterns: {key: string; re: RegExp; names: boolean[]}[] = [];
const compile = () =>
  Object.keys(EN)
    .filter(k => /\{[xn]\}/.test(k))
    // Longer fixed text first, so specific phrases win over generic ones like "{x} · {x}".
    .sort((a, b) => b.replace(SLOT, '').length - a.replace(SLOT, '').length)
    .map(k => {
      const slots = k.match(SLOT)!,
        body = k
          .split(SLOT)
          .map(escape)
          .reduce((re, part, i) => re + (i ? (slots[i - 1] === '{n}' ? '([\\d][\\d,.]*)' : '(.+?)') : '') + part, '');
      // Slots wrapped in ‘…’ hold sailor names, which may stay in Korean.
      const parts = k.split(SLOT),
        names = slots.map((_, i) => parts[i].endsWith('‘') && parts[i + 1].startsWith('’'));
      return {key: k, re: new RegExp('^' + body + '$', 's'), names};
    });
const SOURCES: Record<Exclude<Lang, 'ko'>, () => Promise<Record<string, string>>> = {
  en: () => import('./en').then(m => m.EN),
  vi: () => import('./vi').then(m => m.default),
  zh: () => import('./zh').then(m => m.default),
  ru: () => import('./ru').then(m => m.default),
};
// Text missing from a newer language falls back to English rather than Korean.
export async function loadDictionary(target: Lang = 'en') {
  if (loaded || target === 'ko') return;
  const [en, own] = await Promise.all([SOURCES.en(), target === 'en' ? null : SOURCES[target]()]);
  EN = Object.fromEntries(Object.entries({...en, ...own}).map(([k, v]) => [squash(k), v]));
  patterns = compile();
  loaded = true;
  cache.clear();
}
export const missing = new Set<string>();
// Exposed for the English QA run, which also checks canvas captions.
if (typeof window !== 'undefined') (window as unknown as {__i18nMissing: Set<string>}).__i18nMissing = missing;
function core(text: string, depth: number): string {
  if (!HANGUL.test(text)) return text;
  const exact = EN[text];
  if (exact !== undefined) return exact;
  if (depth > 4) return text;
  for (const p of patterns) {
    const m = text.match(p.re);
    if (!m) continue;
    let i = 0,
      wrong = false;
    const out = EN[p.key].replace(SLOT, () => {
      const part = core(m[i + 1], depth + 1);
      // A capture that still holds Korean means the split was wrong, unless it is a name.
      if (!p.names[i] && HANGUL.test(part)) wrong = true;
      i++;
      return part;
    });
    if (!wrong) return out;
  }
  // Leading or trailing symbols (○ ✓ ◇ ★ digits) stay; only the words are looked up.
  const edge = text.match(/^([^가-힣]*?)\s*([가-힣].*[가-힣.!?)])\s*([^가-힣]*)$/s);
  if (edge && (edge[1] || edge[3])) {
    const inner = core(edge[2], depth + 1);
    if (!HANGUL.test(inner))
      return [edge[1], inner, edge[3]]
        .filter(Boolean)
        .join(' ')
        .replace(/ ([:.,])/g, '$1');
  }
  for (const sep of [' · ', ' / ', ' → ', ': ']) {
    if (!text.includes(sep)) continue;
    const parts = text.split(sep).map(part => core(part.trim(), depth + 1));
    if (parts.every(part => !HANGUL.test(part))) return parts.join(sep);
  }
  if (loaded) missing.add(text);
  return text;
}
// Canvas captions repeat every frame, so results are memoized (bounded).
const cache = new Map<string, string>();
export function translateTo(target: Lang, text: string) {
  if (target === 'ko' || !HANGUL.test(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const lead = text.match(/^\s*/)![0],
    trail = text.match(/\s*$/)![0],
    out = lead + core(squash(text), 0) + trail;
  if (cache.size > 4000) cache.clear();
  cache.set(text, out);
  return out;
}
export const translate = (text: string) => translateTo(lang, text);
const ATTRS = ['aria-label', 'placeholder', 'alt', 'title'];
export function translateTree(root: Node) {
  if (lang === 'ko') return;
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue ?? '';
      if (HANGUL.test(t)) {
        const next = translate(t);
        if (next !== t) node.nodeValue = next;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    // Names and the language switch opt out with the standard translate="no" attribute.
    if (el.getAttribute('translate') === 'no') return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && HANGUL.test(v)) {
        const next = translate(v);
        if (next !== v) el.setAttribute(a, next);
      }
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
}
// Translates whatever later code writes into these roots (innerHTML, textContent, attributes).
export function observe(...roots: Element[]) {
  const observer = new MutationObserver(records => {
    if (lang === 'ko') return;
    for (const r of records) {
      const owner = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
      if (owner?.closest('[translate="no"]')) continue;
      if (r.type === 'characterData') translateTree(r.target);
      else if (r.type === 'attributes') translateTree(r.target);
      else r.addedNodes.forEach(translateTree);
    }
  });
  for (const root of roots)
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  return observer;
}
