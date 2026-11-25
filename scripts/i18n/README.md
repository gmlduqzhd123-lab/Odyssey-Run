# Translation tables

`tr.py` … `tr8.py` hold the English, Vietnamese, Chinese and Russian text for the Korean strings
added in each round (`'한국어': ("English", "Tiếng Việt", "中文", "Русский")`; `{x}` is any text,
`{n}` a number). `npm run translations:gen` turns them into `src/i18n/*-5.ts`; then regenerate
the font with `scripts/subset-font.py` and run `QA_LANG=en npm run test:i18n` (and vi, zh, ru) to
find any string still untranslated. Add a new round as `tr9.py` with a `T9` table and list it in
`gen.py`.
