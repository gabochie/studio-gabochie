#!/usr/bin/env python3
"""Phase 3 image optimization: resize, re-encode, compose OG cards.

Idempotent-ish: re-running re-derives from CURRENT files (gallery/before-after
are resized from their originals only the first time — do not re-run after
deploy unless sources are restored). Prints a before/after table.

Steps:
  1. gallery/*.jpg (800x450) -> 640w q70 jpg + 640w q65 webp twins (same names)
  2. books before/after (1024^2) -> 640w q72 jpg + q65 webp twins
  3. headshot-320.jpg (new, 320w q72) for the 160px press circle
  4. studio-logo2.png -> 256w PNG (same name; transparency preserved)
  5. og-image.jpg: compose 1200x630 brand card (overwrite)
  6. love-of-the-lord/og-cover.png: compose 1200x630 card (overwrite)
  7. manifest screenshots -> q75 JPG twins (PNGs kept; deleted by hand after
     manifest.webmanifest is repointed and verified)
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SAVED = []  # (label, before_kb, after_kb)


def kb(path):
    return os.path.getsize(path) / 1024


def save_jpg(im, path, q):
    if im.mode in ('RGBA', 'LA', 'PA'):
        im = im.convert('RGB')
    im.save(path, 'JPEG', quality=q, optimize=True, progressive=True)


def resize_w(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def fonts(big, small):
    def load(names, size):
        for n in names:
            for d in (r'C:\Windows\Fonts', '/usr/share/fonts'):
                p = os.path.join(d, n)
                if os.path.exists(p):
                    try:
                        return ImageFont.truetype(p, size)
                    except Exception:
                        pass
        return ImageFont.load_default()
    return (load(['arialbd.ttf', 'Arial Bold.ttf', 'DejaVuSans-Bold.ttf'], big),
            load(['arial.ttf', 'Arial.ttf', 'DejaVuSans.ttf'], small))


def text_center(draw, y, text, font, fill, tracking=0):
    if not tracking:
        l, t, r, b = draw.textbbox((0, 0), text, font=font)
        draw.text(((1200 - (r - l)) / 2, y), text, font=font, fill=fill)
        return
    widths = []
    for ch in text:
        l, t, r, b = draw.textbbox((0, 0), ch, font=font)
        widths.append(r - l)
    total = sum(widths) + tracking * (len(text) - 1)
    x = (1200 - total) / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking


def og_card(path, title, subtitle, fmt):
    img = Image.new('RGB', (1200, 630), '#0A1628')
    d = ImageDraw.Draw(img)
    f_big, f_small = fonts(92, 44)
    d.rectangle([80, 190, 1120, 192], fill='#C9A84C')
    text_center(d, 230, title, f_big, '#C9A84C', tracking=14)
    text_center(d, 360, subtitle, f_small, '#E8EEF7')
    d.rectangle([80, 470, 1120, 472], fill='#C9A84C')
    if fmt == 'JPEG':
        img.save(path, 'JPEG', quality=82, optimize=True)
    else:
        img.save(path, 'PNG', optimize=True)


def main():
    # 1. gallery
    for name in ['behind-scenes', 'book-launch', 'community-outreach',
                 'creative-workshop', 'ministry-moment', 'teaching-session']:
        jpg = 'assets/images/gallery/%s.jpg' % name
        webp = 'assets/images/gallery/%s.webp' % name
        before = kb(jpg) + (kb(webp) if os.path.exists(webp) else 0)
        im = resize_w(Image.open(jpg), 640)
        assert im.size == (640, 360), (name, im.size)
        save_jpg(im, jpg, 70)
        im.save(webp, 'WEBP', quality=65, method=6)
        after = kb(jpg) + kb(webp)
        SAVED.append(('gallery/%s (jpg+webp)' % name, before, after))

    # 2. before/after
    for name in ['before', 'after']:
        jpg = 'books/fearless-steps/img/%s.jpg' % name
        webp = 'books/fearless-steps/img/%s.webp' % name
        before = kb(jpg)
        im = resize_w(Image.open(jpg), 640)
        assert im.size == (640, 640), (name, im.size)
        save_jpg(im, jpg, 72)
        im.save(webp, 'WEBP', quality=65, method=6)
        SAVED.append(('fearless %s (jpg+new webp)' % name, before, kb(jpg) + kb(webp)))

    # 3. headshot display file
    src = 'assets/images/headshot.jpg'
    before = kb(src)
    im = resize_w(Image.open(src), 320)
    assert im.size == (320, 320), im.size
    save_jpg(im, 'assets/images/headshot-320.jpg', 72)
    SAVED.append(('headshot-320.jpg (new)', 0, kb('assets/images/headshot-320.jpg')))
    print('headshot.jpg kept at %dkb for press download link' % round(before))

    # 4. studio logo
    logo = 'assets/images/studio-logo2.png'
    before = kb(logo)
    im = Image.open(logo)
    im = im.resize((256, round(im.height * 256 / im.width)), Image.LANCZOS)
    im.save(logo, 'PNG', optimize=True)
    SAVED.append(('studio-logo2.png 1536->256w', before, kb(logo)))

    # 5+6. OG cards
    before = kb('assets/images/og-image.jpg')
    og_card('assets/images/og-image.jpg', 'STUDIO GABOCHIE',
            'Creativity, Love & Wisdom', 'JPEG')
    SAVED.append(('og-image.jpg 810x540 photo -> 1200x630 card', before,
                  kb('assets/images/og-image.jpg')))
    before = kb('love-of-the-lord/og-cover.png')
    og_card('love-of-the-lord/og-cover.png', 'LOVE OF THE LORD',
            'Have church right now, where you are.', 'PNG')
    SAVED.append(('og-cover.png 1000x525 -> 1200x630 card', before,
                  kb('love-of-the-lord/og-cover.png')))

    # 7. manifest screenshots -> jpg twins
    for name in ['home-wide', 'home-mobile']:
        png = 'assets/screenshots/%s.png' % name
        jpg = 'assets/screenshots/%s.jpg' % name
        before = kb(png)
        save_jpg(Image.open(png), jpg, 75)
        SAVED.append(('screenshots/%s.png -> jpg twin' % name, 0, kb(jpg)))
    print('PNG screenshots KEPT until manifest is repointed + verified.')

    total_b = sum(b for _, b, _ in SAVED)
    total_a = sum(a for _, _, a in SAVED)
    print('\n%-42s %10s %10s' % ('file', 'before', 'after'))
    for label, b, a in SAVED:
        print('%-42s %9.0fKB %9.0fKB' % (label, b, a))
    print('%-42s %9.0fKB %9.0fKB (%.0fKB saved)' % ('TOTAL', total_b, total_a, total_b - total_a))


if __name__ == '__main__':
    main()
