"""Build the Play Store feature graphic at exactly 1024x500."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SRC = Path(r"C:\Users\hp\.cursor\projects\d-01Engineering-Fasty24\assets\fasty24-partners-feature-bg.png")
OUT = ROOT / "feature-graphic.png"

W, H = 1024, 500
YELLOW = (255, 196, 0, 255)
BLACK = (13, 13, 13, 255)
WHITE = (255, 255, 255, 255)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(fr"C:\Windows\Fonts\{name}", size)


def cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2 - 40)  # bias left so the technician stays on the right
    top = max(0, (nh - th) // 2 + 20)
    return im.crop((left, top, left + tw, top + th))


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main() -> None:
    bg = cover(Image.open(SRC).convert("RGB"), (W, H)).convert("RGBA")

    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    for x in range(0, 620):
        t = 1 - (x / 620)
        alpha = int(210 * (t**1.15))
        shade_draw.line([(x, 0), (x, H)], fill=(8, 8, 8, alpha))
    bg = Image.alpha_composite(bg, shade)

    draw = ImageDraw.Draw(bg)
    title = font("segoeuib.ttf", 54)
    partners = font("segoeuib.ttf", 28)
    tag = font("segoeui.ttf", 22)
    badge = font("segoeuib.ttf", 32)
    twenty = font("segoeuib.ttf", 54)

    # Brand row: yellow Fasty pill + 24
    pill = (56, 148, 236, 214)
    rounded_rect(draw, pill, 12, YELLOW)
    draw.text((146, 158), "Fasty", font=badge, fill=BLACK, anchor="mm")
    draw.text((258, 176), "24", font=twenty, fill=YELLOW, anchor="lm")

    draw.text((56, 248), "PARTNERS", font=partners, fill=YELLOW, anchor="lt")
    draw.text((56, 300), "Get nearby jobs.", font=title, fill=WHITE, anchor="lt")
    draw.text((56, 362), "Earn on your time.", font=title, fill=WHITE, anchor="lt")
    draw.text(
        (56, 434),
        "Official app for Fasty24 service professionals",
        font=tag,
        fill=(200, 200, 200, 255),
        anchor="lt",
    )

    # Accent bar
    draw.rectangle((56, 128, 132, 134), fill=YELLOW)

    out = bg.convert("RGB")
    out.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT} {out.size} {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
