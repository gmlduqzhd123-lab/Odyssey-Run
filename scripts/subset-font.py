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
for path in [*ROOT.glob('src/**/*.ts'), ROOT / 'index.html', *ROOT.glob('public/*.js')]:
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
for record in font['name'].names:
    if record.nameID in (1, 4, 16, 21):
        record.string = 'Odyssey UI'
    elif record.nameID in (3, 6, 20, 25):
        record.string = 'OdysseyUI'
subset.save_font(font, str(ROOT / 'public/fonts/odyssey-ui.woff2'), options)
print(len(text), 'characters')
