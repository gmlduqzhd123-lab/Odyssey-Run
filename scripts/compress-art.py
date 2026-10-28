"""Re-encodes the large artwork WebP files for delivery: same pixel size and a bit-identical
alpha channel (contact masks are built from alpha, so they stay valid), colour at WebP quality
85. Each file gets a new content-hash name, and every reference in src/, docs/ and
ASSET_CREDITS.md is renamed, with full SHA-256 values updated where recorded.

  python3 scripts/compress-art.py            # files shrinking by at least 30 % are replaced
"""
import hashlib
import io
import pathlib
import re

from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = ROOT / 'public/assets/art'
TEXT = [*ROOT.glob('src/**/*.ts'), *ROOT.glob('docs/*.json'), *ROOT.glob('docs/*.md'), ROOT / 'ASSET_CREDITS.md']
renames = {}
for path in sorted(ART.glob('*.webp')):
    old = path.read_bytes()
    image = Image.open(io.BytesIO(old)).convert('RGBA')
    out = io.BytesIO()
    image.save(out, 'WEBP', quality=85, alpha_quality=100, method=6, exact=True)
    new = out.getvalue()
    if len(new) > len(old) * 0.7:
        continue
    again = Image.open(io.BytesIO(new)).convert('RGBA')
    if ImageChops.difference(image.getchannel('A'), again.getchannel('A')).getbbox() is not None:
        print('skip (alpha changed)', path.name)
        continue
    digest = hashlib.sha256(new).hexdigest()
    stem = re.sub(r'-[0-9a-f]{12}$', '', path.stem)
    target = ART / f'{stem}-{digest[:12]}.webp'
    target.write_bytes(new)
    path.unlink()
    renames[path.name] = (target.name, hashlib.sha256(old).hexdigest(), digest)
    print(f'{path.name} {len(old) // 1024} KB -> {target.name} {len(new) // 1024} KB')
for file in TEXT:
    text = file.read_text(encoding='utf-8')
    changed = text
    for old_name, (new_name, old_sha, new_sha) in renames.items():
        changed = changed.replace(old_name, new_name).replace(old_sha, new_sha)
    if changed != text:
        file.write_text(changed, encoding='utf-8')
        print('updated', file.relative_to(ROOT))
