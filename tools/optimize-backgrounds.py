"""Build bounded-size runtime backgrounds; keep original artwork untouched.

Requires Pillow: python -m pip install Pillow
Run from the repository root: python tools/optimize-backgrounds.py
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
outputs = [
    (root / 'bg_image' / 'optimized', (1280, 512), 78),
    (root / 'bg_image' / 'optimized' / 'mobile', (960, 384), 74),
]
for out, _, _ in outputs:
    out.mkdir(exist_ok=True)
for source in sorted((root / 'bg_image').glob('*.png')):
    with Image.open(source) as image:
        for out, bounds, quality in outputs:
            runtime = image.copy()
            runtime.thumbnail(bounds, Image.Resampling.LANCZOS)
            runtime.convert('RGB').save(out / (source.stem + '.webp'), quality=quality, method=6)
