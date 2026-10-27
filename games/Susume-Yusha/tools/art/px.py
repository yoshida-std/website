# 勇者の絵に合わせたキャラを描く小さな道具。4倍の大きさで形・陰・ふちを描き、最後に縮める（勇者と同じ縮め方）
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import colorsys, math

S = 4  # 描く倍率

def hx(h):
    if isinstance(h, tuple): return h[:3]
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))

def tone(c, dl=0.0, ds=0.0, dh=0.0):
    r, g, b = [v / 255 for v in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0, min(1, l + dl)); s = max(0, min(1, s + ds)); h = (h + dh) % 1
    return tuple(int(round(v * 255)) for v in colorsys.hls_to_rgb(h, l, s))

def shades(c):
    c = hx(c) if isinstance(c, str) else c
    return {
        'line': tone(c, -0.36, -0.05, 0.02),
        'dark': tone(c, -0.16, 0.0, 0.015),
        'base': c,
        'lite': tone(c, 0.13, -0.04, -0.01),
        'hi': tone(c, 0.26, -0.1, -0.02),
    }

def shift(m, dx, dy):
    o = Image.new('L', m.size, 0); o.paste(m, (dx, dy)); return o

def erode(m, r):
    return m.filter(ImageFilter.MinFilter(2 * r + 1))

class Fig:
    def __init__(self, w, h, line='#2a1a14'):
        self.w, self.h = w, h
        self.W, self.H = w * S, h * S
        self.img = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        self.line = hx(line)

    def mask(self, fn):
        m = Image.new('L', (self.W, self.H), 0)
        fn(ImageDraw.Draw(m)); return m

    def part(self, fn, col, shade=True, stroke=True, k=7, hk=5, gloss=False, flat=False):
        m = self.mask(fn) if callable(fn) else fn
        sh = shades(col)
        layer = Image.new('RGBA', (self.W, self.H), sh['base'] + (255,))
        if shade and not flat:
            dark = ImageChops.subtract(m, shift(m, -k, -k))          # 右下のふち: かげ
            lite = ImageChops.subtract(m, shift(m, hk, hk))           # 左上のふち: あかり
            layer.paste(sh['dark'] + (255,), mask=dark)
            layer.paste(sh['lite'] + (255,), mask=lite)
            if gloss:
                g = ImageChops.subtract(lite, shift(m, hk + 5, hk + 5).point(lambda v: 0 if v else 255))
                layer.paste(sh['hi'] + (255,), mask=ImageChops.subtract(m, shift(m, 3, 3)).point(lambda v: v if v else 0) if False else g)
        if stroke:
            e = ImageChops.subtract(m, erode(m, 2))
            layer.paste(sh['line'] + (255,), mask=e)
        self.img.paste(layer, mask=m)
        return m

    def outline(self, r=4):
        a = self.img.getchannel('A')
        big = a.filter(ImageFilter.MaxFilter(2 * r + 1))
        base = Image.new('RGBA', (self.W, self.H), self.line + (255,))
        out = Image.new('RGBA', (self.W, self.H), (0, 0, 0, 0))
        out.paste(base, mask=big)
        out.alpha_composite(self.img)
        self.img = out

    def final(self, harden=110):
        self.outline()
        r = self.img.resize((self.w, self.h), Image.LANCZOS)
        px = r.load()
        for y in range(r.height):
            for x in range(r.width):
                c = px[x, y]; px[x, y] = (c[0], c[1], c[2], 255 if c[3] > harden else 0)
        return r

# 形（4倍の座標で指定）
def ell(cx, cy, rx, ry):
    return lambda d: d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)

def poly(*pts):
    return lambda d: d.polygon([(x, y) for x, y in pts], fill=255)

def cap(x1, y1, x2, y2, r):
    def f(d):
        d.line((x1, y1, x2, y2), fill=255, width=int(2 * r))
        d.ellipse((x1 - r, y1 - r, x1 + r, y1 + r), fill=255)
        d.ellipse((x2 - r, y2 - r, x2 + r, y2 + r), fill=255)
    return f

def taper(x1, y1, r1, x2, y2, r2):
    # 太さの変わる棒（腕・脚）
    a = math.atan2(y2 - y1, x2 - x1); nx, ny = -math.sin(a), math.cos(a)
    def f(d):
        d.polygon([(x1 + nx * r1, y1 + ny * r1), (x2 + nx * r2, y2 + ny * r2), (x2 - nx * r2, y2 - ny * r2), (x1 - nx * r1, y1 - ny * r1)], fill=255)
        d.ellipse((x1 - r1, y1 - r1, x1 + r1, y1 + r1), fill=255)
        d.ellipse((x2 - r2, y2 - r2, x2 + r2, y2 + r2), fill=255)
    return f

def union(*fs):
    def f(d):
        for g in fs: g(d)
    return f

def rrect(x1, y1, x2, y2, r):
    return lambda d: d.rounded_rectangle((x1, y1, x2, y2), r, fill=255)

def pt(d, x, y, col, r=2):
    d.ellipse((x - r, y - r, x + r, y + r), fill=hx(col) if isinstance(col, str) else col)
