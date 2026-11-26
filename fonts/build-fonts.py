#!/usr/bin/env python3
"""Rebuild the web fonts shipped with Dartbox (needs: pip install fonttools brotli).

  DartboxUI-Regular/Bold.woff2  DejaVu Sans, subset to what the UI uses
  DartboxEmoji.woff2            Noto Emoji (monochrome, OFL), subset to the emoji the UI uses
  DartboxIcons.woff2            the few symbols neither font has (circled X), drawn here

Usage: python3 fonts/build-fonts.py [path/to/DejaVu/dir] [path/to/NotoEmoji[wght].ttf]
Noto Emoji: https://github.com/google/fonts/tree/main/ofl/notoemoji (not kept in the repo)
(also needs: pip install fonttools brotli)
"""
import math
import os
import sys

from fontTools import subset
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

HERE = os.path.dirname(os.path.abspath(__file__))
DEJAVU = sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/dejavu"
NOTO_EMOJI = sys.argv[2] if len(sys.argv) > 2 else "NotoEmoji[wght].ttf"
EMOJI = "\U0001f3af\u23f8\U0001f500\U0001f3c6\u270b\U0001f512\U0001f4f7\U0001f3e0\U0001f310\u2615\u26a0\u2699\u2764"
UPM = 2048
CY = 700  # vertical centre of the icons

# ranges are written "a-b"; everything the hub and playroom print
TEXT = ("\u0020-\u007e\u00a0-\u00ff\u0131\u0152\u0153\u0178\u0394\u2010-\u2027\u2030-\u203a\u20ac\u2122\u2190-\u2199"
        "\u21b6\u21ba\u21bb\u21a9\u2205\u2206\u2300\u2605\u2615\u2713\u2717\u2715\u2716\u2699\u26a0\u2764"
        "\u2b06\u27f3\u25b6\u25b2-\u25c6\u2580-\u2588\u2197\u00d7\ufe0f")


def ring_points(cx, cy, rx, ry, cw):
    # closed all-off-curve quadratic contour on an octagon around the circle
    k = 1 / math.cos(math.pi / 8)
    pts = [(round(cx + rx * k * math.cos(math.radians(22.5 + 45 * i))),
            round(cy + ry * k * math.sin(math.radians(22.5 + 45 * i)))) for i in range(8)]
    return pts[::-1] if cw else pts


def circle(pen, cx, cy, r, cw=True, ry=None):
    pen.qCurveTo(*ring_points(cx, cy, r, ry or r, cw), None)
    pen.closePath()


def poly(pen, pts, cw=True):
    # TrueType: outer contours clockwise, holes counter-clockwise
    pts = [(round(x), round(y)) for x, y in pts]
    area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
    if (area < 0) != cw:
        pts = pts[::-1]
    pen.moveTo(pts[0])
    for p in pts[1:]:
        pen.lineTo(p)
    pen.closePath()


def rect(pen, x0, y0, x1, y1):
    poly(pen, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def bar(pen, a, b, w):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    ox, oy = -dy / n * w / 2, dx / n * w / 2
    poly(pen, [(a[0] + ox, a[1] + oy), (b[0] + ox, b[1] + oy), (b[0] - ox, b[1] - oy), (a[0] - ox, a[1] - oy)])






def crossed(p):
    circle(p, 1024, CY, 800)
    circle(p, 1024, CY, 690, cw=False)
    bar(p, (700, CY - 330), (1348, CY + 330), 150)
    bar(p, (700, CY + 330), (1348, CY - 330), 150)
















ICONS = {0x24CD: ("crossed", crossed)}


def build_icons(out):
    names = [".notdef", "space"] + [n for n, _ in ICONS.values()]
    draw = {n: d for n, d in ICONS.values()}
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({cp: n for cp, (n, _) in ICONS.items()} | {0x20: "space"})
    glyphs = {}
    for name in names:
        pen = TTGlyphPen(None)
        if name in draw:
            draw[name](pen)
        glyphs[name] = pen.glyph()
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (UPM, 0) for n in names})
    fb.setupHorizontalHeader(ascent=1900, descent=-500)
    fb.setupNameTable({"familyName": "DartboxIcons", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=1900, sTypoDescender=-500, usWinAscent=1900, usWinDescent=500)
    fb.setupPost()
    fb.font.flavor = "woff2"
    fb.save(out)


def expand(spec):
    out, i = [], 0
    while i < len(spec):
        if i + 2 < len(spec) and spec[i + 1] == "-":
            out += range(ord(spec[i]), ord(spec[i + 2]) + 1)
            i += 3
        else:
            out.append(ord(spec[i]))
            i += 1
    return out


def build_text(src, out):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga"]
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=expand(TEXT))
    sub.subset(font)
    subset.save_font(font, out, opts)


def build_emoji(src, out):
    from fontTools.varLib import instancer
    from fontTools.ttLib import TTFont
    font = instancer.instantiateVariableFont(TTFont(src), {"wght": 500})
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = []
    sub = subset.Subsetter(opts)
    sub.populate(text=EMOJI)
    sub.subset(font)
    subset.save_font(font, out, opts)


if __name__ == "__main__":
    build_emoji(NOTO_EMOJI, os.path.join(HERE, "DartboxEmoji.woff2"))
    build_icons(os.path.join(HERE, "DartboxIcons.woff2"))
    for style, f in (("Regular", "DejaVuSans.ttf"), ("Bold", "DejaVuSans-Bold.ttf")):
        build_text(os.path.join(DEJAVU, f), os.path.join(HERE, f"DartboxUI-{style}.woff2"))
    for f in sorted(os.listdir(HERE)):
        if f.endswith(".woff2"):
            print(f, os.path.getsize(os.path.join(HERE, f)))
