#!/usr/bin/env python3
"""Per-page Open Graph image generator (Pillow — no browser).

Draws a branded 1200x630 social card for every landing page so shared links get
a distinct, title-bearing preview. Reads each generated page's <title> + eyebrow
from the HTML. Reliable + fast (vs. headless Chrome, which hangs on repeated
launches in this environment).

Run AFTER gen-pages.mjs:  python3 scripts/gen_og.py
Output: /og/<slug>.png  (referenced by pages' og:image / twitter:image)
"""
import os, re, glob, html
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OG = os.path.join(ROOT, "og")
os.makedirs(OG, exist_ok=True)
W, H = 1200, 630

def font_path(*cands):
    for c in cands:
        if os.path.exists(c):
            return c
    return None

BOLD = font_path("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                 "/Library/Fonts/Arial Bold.ttf",
                 "/System/Library/Fonts/HelveticaNeue.ttc",
                 "/System/Library/Fonts/Helvetica.ttc")
REG  = font_path("/System/Library/Fonts/Supplemental/Arial.ttf",
                 "/Library/Fonts/Arial.ttf",
                 "/System/Library/Fonts/Helvetica.ttc")

def f(size, bold=True):
    p = BOLD if bold else REG
    try:
        return ImageFont.truetype(p, size)
    except Exception:
        return ImageFont.load_default()

def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

ACCENTS = {"compar": "#c4b5fd", "guide": "#4ede9a", "subject": "#4cd7f6",
           "use": "#4cd7f6", "tool": "#a78bfa", "free": "#a78bfa", "feature": "#a78bfa"}
def accent_for(eyebrow):
    w = re.split(r"[ ·|]", (eyebrow or "").strip().lower())[0]
    for k, v in ACCENTS.items():
        if w.startswith(k):
            return v
    return "#a78bfa"

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for word in words:
        trial = (cur + " " + word).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines

def gradient_bg():
    top, bot = hexrgb("#0b1326"), hexrgb("#0d1a36")
    img = Image.new("RGB", (W, H), top)
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        for x in range(W):
            px[x, y] = col
    return img

def glow(img, color, cx, cy, r):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color + (90,))
    layer = layer.filter(ImageFilter.GaussianBlur(120))
    img.paste(layer, (0, 0), layer)

def card(title, eyebrow, accent_hex, out):
    acc = hexrgb(accent_hex)
    img = gradient_bg().convert("RGBA")
    glow(img, acc, W - 120, -60, 320)
    glow(img, hexrgb("#7c3aed"), -80, H + 80, 300)
    d = ImageDraw.Draw(img)
    pad = 84

    # Logo + wordmark
    d.rounded_rectangle([pad, pad, pad + 68, pad + 68], radius=17, fill=hexrgb("#7c3aed"))
    lf = f(40, True)
    bb = d.textbbox((0, 0), "B", font=lf)
    d.text((pad + 34 - (bb[2]-bb[0])/2, pad + 34 - (bb[3]-bb[1])/2 - bb[1]), "B", font=lf, fill=(255, 255, 255))
    d.text((pad + 86, pad + 16), "Brainfy", font=f(32, True), fill=(255, 255, 255))

    # Eyebrow (uppercase, light tracking via spaced caps)
    eb = " ".join(list(eyebrow.upper().replace("·", "·")))  # simple tracking
    eb_disp = eyebrow.upper()
    d.text((pad, 300), eb_disp, font=f(23, True), fill=acc)

    # Title (wrapped, size by length)
    n = len(title)
    size = 74 if n <= 26 else 60 if n <= 42 else 50 if n <= 64 else 42 if n <= 90 else 36
    tf = f(size, True)
    lines = wrap(d, title, tf, W - 2 * pad)
    y = 340
    lh = size * 1.12
    for ln in lines[:4]:
        d.text((pad, y), ln, font=tf, fill=(255, 255, 255))
        y += lh

    # Footer: brainfy.online  +  pill
    ff = f(24, False)
    d.text((pad, H - pad - 8), "brainfy.online", font=ff, fill=hexrgb("#94a3b8"))
    pill = "Free AI study app"
    pf = f(20, True)
    pw = d.textlength(pill, font=pf)
    px0 = W - pad - pw - 36
    d.rounded_rectangle([px0, H - pad - 18, W - pad, H - pad + 22], radius=20, outline=(255, 255, 255, 60), width=2)
    d.text((px0 + 18, H - pad - 12), pill, font=pf, fill=hexrgb("#dae2fd"))

    img.convert("RGB").save(out, "PNG", optimize=True)

# ── Targets: every landing page (+ resources, founder); skip app/legal/verify ──
SKIP = {"404.html", "index.html", "privacy.html", "terms.html"}
count = 0
for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    fn = os.path.basename(path)
    if fn in SKIP or fn.startswith("google"):
        continue
    h = open(path, encoding="utf-8").read()
    slug = fn[:-5]
    m = re.search(r"<title>(.*?)</title>", h, re.S)
    title = html.unescape(m.group(1)).strip() if m else slug
    title = re.sub(r"\s*[|—]\s*Brainfy\s*$", "", title).strip()
    me = re.search(r'<p class="eyebrow"[^>]*>(.*?)</p>', h, re.S)
    eyebrow = re.sub(r"<[^>]+>", "", html.unescape(me.group(1))).strip() if me else ""
    if not eyebrow:
        eyebrow = "Brainfy Resources" if fn == "resources.html" else "About Brainfy" if fn == "founder.html" else "Brainfy"
    card(title, eyebrow, accent_for(eyebrow), os.path.join(OG, slug + ".png"))
    count += 1

print(f"Rendered {count} OG images into /og/")
