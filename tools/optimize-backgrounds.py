"""Build bounded-size runtime backgrounds; keep original artwork untouched.

Requires Pillow: python -m pip install Pillow
Run from the repository root: python tools/optimize-backgrounds.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
out = root / 'bg_image' / 'optimized'
out.mkdir(exist_ok=True)
for source in sorted((root / 'bg_image').glob('*.png')):
    with Image.open(source) as image:
        image.thumbnail((1280, 512), Image.Resampling.LANCZOS)
        image.convert('RGB').save(out / (source.stem + '.webp'), quality=78, method=6)
