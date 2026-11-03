"""Builds the strait's own landscape panel from the stormy-sea painting on the landscape sheet,
so the strait no longer shares its view with the wind island's boss: the painting is mirrored,
the sky cooled toward the strait's blue-grey, two dark cliffs are drawn closing in from the sides,
and Charybdis's rings turn in the water. Writes public/assets/art/strait-view-<hash>.webp and
updates src/assets/terrain-files.ts.

  pip install pillow
  python3 scripts/compose-strait-view.py
"""
import hashlib
import pathlib
import re

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ROOT / 'src' / 'assets' / 'terrain-files.ts'
sheet = next((ROOT / 'public' / 'assets' / 'art').glob('landscape-sheet-*.webp'))
img = Image.open(sheet).convert('RGBA')
# The stormy sea panel (see REGIONS['view-storm']), mirrored so the wreck sits on the left.
panel = ImageOps.mirror(img.crop((8, 452, 758, 595)))
W, H = panel.size
# Cool the colours toward slate blue and deepen the contrast a little.
panel = ImageEnhance.Color(panel).enhance(0.8)
tint = Image.new('RGBA', panel.size, (60, 90, 120, 70))
panel = Image.alpha_composite(panel, tint)
panel = ImageEnhance.Contrast(panel).enhance(1.15)
draw = ImageDraw.Draw(panel, 'RGBA')
# Two cliffs closing in from the sides, darker toward the edge, with a ragged top.
for side in (-1, 1):
    pts = []
    x0 = 0 if side < 0 else W
    for i, (dx, y) in enumerate([(0, 0), (90, 6), (130, 34), (115, 60), (150, 92), (120, 118), (140, H)]):
        pts.append((x0 - side * dx, y))
    pts.append((x0, H))
    draw.polygon(pts, fill=(38, 44, 52, 235))
    # A lighter rim where spray hits the rock.
    rim = [(x - side * 6, y) for x, y in pts[:-1]]
    draw.line(rim, fill=(120, 136, 150, 160), width=3)
# Charybdis: concentric rings in the water between the cliffs.
cx, cy = W // 2 + 40, 118
for k, r in enumerate((26, 48, 70, 92)):
    draw.ellipse((cx - r, cy - r * 0.32, cx + r, cy + r * 0.32), outline=(205, 228, 240, 150 - k * 20), width=3)
draw.ellipse((cx - 10, cy - 4, cx + 10, cy + 4), fill=(20, 40, 60, 220))
panel = panel.filter(ImageFilter.SMOOTH)
out_dir = ROOT / 'public' / 'assets' / 'art'
tmp = out_dir / 'strait-view.tmp.webp'
panel.convert('RGB').save(tmp, 'WEBP', quality=82, method=6)
digest = hashlib.sha256(tmp.read_bytes()).hexdigest()[:12]
final = out_dir / f'strait-view-{digest}.webp'
for old in out_dir.glob('strait-view-*.webp'):
    old.unlink()
tmp.rename(final)
rel = final.relative_to(ROOT / 'public').as_posix()
text = FILES.read_text(encoding='utf-8')
if "'strait-view'" in text:
    text = re.sub(r"'strait-view': '[^']+'", f"'strait-view': '{rel}'", text)
else:
    text = text.replace("} as const;", f"  'strait-view': '{rel}',\n}} as const;")
FILES.write_text(text, encoding='utf-8')
print(rel, final.stat().st_size, panel.size)
