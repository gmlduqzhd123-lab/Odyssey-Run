// Translation review sheet for teachers and native speakers.
//   npx tsx scripts/translations.ts export [file.csv]   → every Korean text with en/vi/zh/ru (Excel opens it)
//   npx tsx scripts/translations.ts import file.csv     → writes the edited cells back into src/i18n/
// Import checks each edited cell: the {x}/{n} slots must stay in the same order and no Hangul may
// remain (sailor names in ‘…’ are filled in at run time). Rejected cells are listed, not written.
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {format, resolveConfig} from 'prettier';

const LANGS = ['en', 'vi', 'zh', 'ru'] as const;
type Lang = (typeof LANGS)[number];
const HEADER = ['한국어 (바꾸지 마세요)', 'English', 'Tiếng Việt', '中文', 'Русский'];
const chunk = (lang: Lang, n: number) => `src/i18n/${lang}-${n}.ts`;
const exportName = (lang: Lang, n: number) => `${lang.toUpperCase()}_${n}`;

async function load() {
  const out = {} as Record<Lang, Record<string, string>[]>;
  for (const lang of LANGS) {
    out[lang] = [];
    for (let n = 1; n <= 4; n++) out[lang].push((await import(`../${chunk(lang, n)}`))[exportName(lang, n)]);
  }
  return out;
}
const cell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
export function toCsv(rows: string[][]) {
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') ((field += '"'), i++);
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') (row.push(field), (field = ''));
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      ((row = []), (field = ''));
    } else field += ch;
  }
  if (field || row.length) (row.push(field), rows.push(row));
  return rows.filter(r => r.some(Boolean));
}
const slots = (s: string) => (s.match(/\{[xn]\}/g) ?? []).join('');
export function checkCell(key: string, value: string) {
  if (!value.trim()) return 'empty';
  if (slots(value) !== slots(key)) return `slots ${slots(key) || '(none)'} → ${slots(value) || '(none)'}`;
  if (/[가-힣]/.test(value.replaceAll('엽쌤', ''))) return 'Korean left';
  return '';
}
const quote = (s: string) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;

const [command, file] = process.argv.slice(2);
const main = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (!main) {
  // Imported by the unit tests for the CSV helpers.
} else if (command === 'export') {
  const dicts = await load(),
    rows = [HEADER];
  for (let n = 0; n < 4; n++)
    for (const key of Object.keys(dicts.en[n]))
      rows.push([key, ...LANGS.map(l => dicts[l].find(d => key in d)?.[key] ?? '')]);
  const out = file || 'artifacts/translations.csv';
  await writeFile(out, toCsv(rows));
  console.log(`translations: ${rows.length - 1} texts → ${out}`);
} else if (command === 'import' && file) {
  const rows = parseCsv(await readFile(file, 'utf8')),
    dicts = await load(),
    rejected: string[] = [],
    touched = new Set<string>();
  let changed = 0;
  for (const [key, ...values] of rows.slice(1)) {
    if (!dicts.en.some(d => key in d)) {
      rejected.push(`unknown text: ${key}`);
      continue;
    }
    LANGS.forEach((lang, i) => {
      // Each language splits its entries over the four files in its own way.
      const value = values[i] ?? '',
        at = dicts[lang].findIndex(d => key in d),
        target = at < 0 ? 3 : at;
      if (value === dicts[lang][target][key]) return;
      const problem = checkCell(key, value);
      if (problem) return rejected.push(`${lang} ${problem}: ${key} → ${value}`);
      dicts[lang][target][key] = value;
      touched.add(`${lang}-${target + 1}`);
      changed++;
    });
  }
  const config = await resolveConfig('src/i18n/en-1.ts');
  for (const id of touched) {
    const [lang, n] = id.split('-') as [Lang, string],
      path = chunk(lang, Number(n)),
      before = await readFile(path, 'utf8'),
      head = before.slice(0, before.indexOf('export const')),
      // Comments inside the object stay in front of the entry they described.
      comments = new Map<number, string[]>();
    let entry = 0;
    for (const line of before.slice(before.indexOf('{\n') + 2).split('\n')) {
      if (/^  \/\//.test(line)) comments.set(entry, [...(comments.get(entry) ?? []), line]);
      else if (/^  ['"\p{L}\p{N}_$]/u.test(line)) entry++;
    }
    const body = Object.entries(dicts[lang][Number(n) - 1])
      .flatMap(([k, v], i) => [...(comments.get(i) ?? []), `  ${quote(k)}: ${quote(v)},`])
      .join('\n');
    await writeFile(
      path,
      await format(`${head}export const ${exportName(lang, Number(n))}: Record<string, string> = {\n${body}\n};\n`, {
        ...config,
        filepath: path,
      }),
    );
  }
  for (const r of rejected) console.log('REJECTED ' + r);
  console.log(`translations: ${changed} cells updated, ${rejected.length} rejected`);
  if (rejected.length) process.exitCode = 1;
} else {
  console.log('usage: npx tsx scripts/translations.ts export [file.csv] | import file.csv');
  process.exitCode = 1;
}
