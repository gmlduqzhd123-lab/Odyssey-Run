import json, pathlib, runpy
# The translation tables (tr*.py) next to this file become src/i18n/*-5.ts.
here = pathlib.Path(__file__).resolve().parent
root = here.parents[1]
T = {}
for f in ('tr.py', 'tr2.py', 'tr3.py', 'tr4.py', 'tr5.py', 'tr6.py', 'tr7.py', 'tr8.py', 'tr9.py'):
    ns = runpy.run_path(str(here / f))
    for k in ('T', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'):
        if k in ns: T.update(ns[k])
for i, (l, L) in enumerate([('en', 'EN'), ('vi', 'VI'), ('zh', 'ZH'), ('ru', 'RU')]):
    lines = [f'export const {L}_5: Record<string, string> = {{']
    for k, v in T.items():
        lines.append(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v[i], ensure_ascii=False)},')
    lines.append('};\n')
    (root / 'src' / 'i18n' / f'{l}-5.ts').write_text('\n'.join(lines), encoding='utf-8')
print(len(T), 'entries')
