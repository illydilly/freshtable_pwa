from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
BG = '#7FB069'
BG_DARK = '#6A9758'
WHITE = '#FFFFFF'
ICON_DIR = Path('/home/user/downloads/freshtable_pwa/client/public/icons')
ICON_DIR.mkdir(parents=True, exist_ok=True)


def get_font(size: int):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'
    ]
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


for size in SIZES:
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=BG)

    leaf_w = size * 0.34
    leaf_h = size * 0.46
    leaf = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    leaf_draw = ImageDraw.Draw(leaf)
    leaf_bounds = (
        size * 0.33,
        size * 0.14,
        size * 0.33 + leaf_w,
        size * 0.14 + leaf_h,
    )
    leaf_draw.ellipse(leaf_bounds, fill=WHITE)
    leaf = leaf.rotate(-28, resample=Image.Resampling.BICUBIC, center=(size * 0.5, size * 0.34))
    image.alpha_composite(leaf)

    draw = ImageDraw.Draw(image)
    stem_width = max(3, int(size * 0.028))
    draw.line(
        (
            size * 0.50,
            size * 0.36,
            size * 0.43,
            size * 0.55,
        ),
        fill=WHITE,
        width=stem_width,
    )

    shadow_top = size * 0.60
    draw.rounded_rectangle(
        (size * 0.18, shadow_top, size * 0.82, size * 0.90),
        radius=int(size * 0.12),
        fill=BG_DARK,
    )

    text = 'FT'
    font = get_font(int(size * 0.20))
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    text_x = (size - text_w) / 2
    text_y = shadow_top + ((size * 0.30) - text_h) / 2 - size * 0.01
    draw.text((text_x, text_y), text, fill=WHITE, font=font)

    image.save(ICON_DIR / f'icon-{size}x{size}.png')

print(f'Generated {len(SIZES)} icons in {ICON_DIR}')
