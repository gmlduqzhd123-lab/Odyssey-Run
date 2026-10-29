"""Builds public/fonts/odyssey-ui.woff2 ("Odyssey UI"): Pretendard (SIL OFL 1.1) cut down to the characters the
game's own text uses, so every device shows the same letters at the same size.

Run after adding or changing on-screen text (the unit tests fail when a character is missing):
  pip install fonttools brotli
  npm pack pretendard@1.3.9 && tar xzf pretendard-1.3.9.tgz
  python3 scripts/subset-font.py package/dist/web/variable/woff2/PretendardVariable.woff2
Characters outside the subset (for example unusual syllables in a sailor's name) fall back to
the device font, glyph by glyph.
"""
import pathlib
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parent.parent
chars = {chr(c) for c in range(0x20, 0x7F)}
# Vietnamese, Chinese and Russian dictionaries are not part of the Korean subset: accented Latin
# and Cyrillic come from a second file (below), Chinese from the device font.
OTHER = ('vi', 'zh', 'ru')
sources = [p for p in ROOT.glob('src/**/*.ts') if not (p.parent.name == 'i18n' and p.stem.split('-')[0] in OTHER)]
for path in [*sources, ROOT / 'index.html', *ROOT.glob('public/*.js')]:
    chars.update(ch for ch in path.read_text(encoding='utf-8') if ord(ch) > 0x7E and not ch.isspace())
# Common sailor-name syllables are not added on purpose: names fall back to the device font.
text = ''.join(sorted(chars))
(ROOT / 'public/fonts').mkdir(parents=True, exist_ok=True)
(ROOT / 'public/fonts/odyssey-ui.chars.txt').write_text(text, encoding='utf-8')
options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
font = subset.load_font(sys.argv[1], options)
sub = subset.Subsetter(options)
sub.populate(text=text)
sub.subset(font)
# The OFL reserves the name Pretendard for unmodified fonts, so the cut-down font gets its own
# name; the copyright notice and the licence text (name IDs 0, 13, 14) stay as they are.
def rename(font):
    for record in font['name'].names:
        if record.nameID in (1, 4, 16, 21):
            record.string = 'Odyssey UI'
        elif record.nameID in (3, 6, 20, 25):
            record.string = 'OdysseyUI'


rename(font)
subset.save_font(font, str(ROOT / 'public/fonts/odyssey-ui.woff2'), options)
print(len(text), 'characters')
# Accented Latin (Vietnamese) and Cyrillic (Russian). style.css declares the same ranges as
# unicode-range, so the browser fetches this file only when such a letter is on screen (× and ÷,
# which Korean text uses, stay in the first file).
EXTRA = [(0xC0, 0xD6), (0xD8, 0xF6), (0xF8, 0x24F), (0x300, 0x36F), (0x400, 0x4FF), (0x1E00, 0x1EFF)]
extra = subset.load_font(sys.argv[1], options)
sub = subset.Subsetter(options)
# Only the letters of the two alphabets (and any the dictionaries use) are kept.
letters = set('ĂÂĐÊÔƠƯăâđêôơư' 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя')
letters.update(chr(c) for c in range(0x1EA0, 0x1EFA))
letters.update('ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúý')
for path in ROOT.glob('src/i18n/*.ts'):
    letters.update(ch for ch in path.read_text(encoding='utf-8') if any(a <= ord(ch) <= b for a, b in EXTRA))
sub.populate(text=''.join(sorted(letters)))
sub.subset(extra)
rename(extra)
subset.save_font(extra, str(ROOT / 'public/fonts/odyssey-ui-extra.woff2'), options)
