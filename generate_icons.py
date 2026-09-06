from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (15, 17, 21)
SILVER = (199, 204, 214)
GOLD = (232, 196, 106)


def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), BG + (255,))
    d = ImageDraw.Draw(img)

    pad = int(size * 0.14) if maskable else int(size * 0.06)
    r = (size - pad * 2) / 2
    cx = cy = size / 2

    # two overlapping coins: silver back-left, gold front-right
    offset = r * 0.32
    d.ellipse([cx - offset - r * 0.62, cy - r * 0.62, cx - offset + r * 0.62, cy + r * 0.62],
              fill=SILVER + (255,))
    d.ellipse([cx + offset - r * 0.62, cy - r * 0.62, cx + offset + r * 0.62, cy + r * 0.62],
              fill=GOLD + (255,))

    img.save(os.path.join(OUT, f"icon-{size}.png"))


for s in (192, 512):
    make_icon(s)
make_icon(512, maskable=True)
os.rename(os.path.join(OUT, "icon-512.png"), os.path.join(OUT, "icon-512-maskable.png"))
make_icon(512)  # regenerate the plain (non-maskable) 512 after the rename above
make_icon(180)  # apple-touch-icon

print("done")
