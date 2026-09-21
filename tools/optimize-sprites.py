"""Build alpha-preserving runtime sprites. Originals remain the source of truth.

Requires Pillow. Run: python tools/optimize-sprites.py
Sheets retain logical source coordinates in game.js; pickups need no source crop.
"""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
sources = sorted(root.glob('*.png')) + sorted((root / 'jelly').glob('*.png')) + sorted((root / 'item').glob('*.png'))
for source in sources:
    with Image.open(source) as image:
        image = image.convert('RGBA')
        if source.parent.name in ('jelly', 'item'):
            image.thumbnail((96, 96), Image.Resampling.LANCZOS)
        elif not source.name.startswith('main character'):
            image = image.resize((round(image.width / 2), round(image.height / 2)), Image.Resampling.LANCZOS)
        for folder, scale in (('', 1), ('mobile', .5)):
            target = root / 'optimized' / folder / source.relative_to(root).with_suffix('.webp')
            target.parent.mkdir(parents=True, exist_ok=True)
            runtime = image if scale == 1 else image.resize(
                (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
                Image.Resampling.LANCZOS,
            )
            # Keep player pixel art lossless; other transparent sprites retain alpha.
            runtime.save(target, lossless=source.name.startswith('main character'), quality=82 if folder else 85, method=6)
