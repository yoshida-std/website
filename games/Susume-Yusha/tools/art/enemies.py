# 敵（右向き）を勇者に合わせた絵で描く。セルは描く大きさ（表示の2倍）
import sys; sys.path.insert(0, sys.path[0])
from px import *

def slime(fr):
    f = Fig(72, 60, '#0e2a5c'); W, H = f.W, f.H
    sq = 1.0 if fr == 0 else 0.86; wd = 1.0 if fr == 0 else 1.12
    cx, by = W / 2, H - 6
    ht = 196 * sq; rw = 108 * wd
    body = lambda d: d.polygon([(cx + rw * math.sin(t) * (0.55 + 0.45 * (1 - (1 - math.cos(t)) / 2)) * (1 if t > 0 else 1),
                                 by - ht * (0.5 - 0.5 * math.cos(t)) * (1 - 0.12 * math.sin(t) ** 8))
                                for t in [i / 60 * 2 * math.pi - math.pi for i in range(61)]], fill=255)
    def drop(d):
        pts = []
        for i in range(81):
            t = i / 80 * 2 * math.pi
            y = math.cos(t)                       # 1 下 … -1 上
            w = math.sqrt(max(0, 1 - y * y)) * (0.62 + 0.38 * (y + 1) / 2) ** 0.9
            pts.append((cx + rw * w * math.sin(t) * (1 if math.sin(t) >= 0 else 1), by - ht * (1 - y) / 2))
        tip = (cx + 22, by - ht - 26)
        d.polygon(pts, fill=255); d.polygon([(cx - 26, by - ht + 34), tip, (cx + 46, by - ht + 40)], fill=255)
        d.ellipse((cx - rw, by - ht * 0.62, cx + rw, by + 2), fill=255)
    f.part(drop, '#3f8ff0', k=18, hk=10)
    d = ImageDraw.Draw(f.img)
    d.ellipse((cx - 70, by - ht * 0.78, cx - 30, by - ht * 0.52), fill=(220, 240, 255))      # つや
    d.ellipse((cx - 62, by - ht * 0.74, cx - 46, by - ht * 0.64), fill=(255, 255, 255))
    ey = by - ht * 0.42
    for ex in (cx + 4, cx + 52):
        d.ellipse((ex - 11, ey - 16, ex + 11, ey + 16), fill=hx('#0c1838'))
        d.ellipse((ex - 6, ey - 12, ex + 2, ey - 2), fill=(255, 255, 255))
    d.arc((cx + 8, ey + 4, cx + 48, ey + 34), 20, 160, fill=hx('#0c1838'), width=7)
    d.ellipse((cx - 20, ey + 10, cx - 4, ey + 20), fill=hx('#7cc0ff'))
    return f.final()

def bat(fr):
    f = Fig(64, 40, '#1e0f2e'); W, H = f.W, f.H
    cx, cy = W / 2, H / 2 + 6
    wc = '#7a4ab8'; mem = '#a07ad8'
    up = fr == 0
    for sx in (-1, 1):
        if up:
            pts = [(cx + sx * 14, cy - 6), (cx + sx * 54, cy - 64), (cx + sx * 86, cy - 62), (cx + sx * 116, cy - 30), (cx + sx * 96, cy - 10), (cx + sx * 80, cy - 18), (cx + sx * 64, cy + 2), (cx + sx * 44, cy - 4), (cx + sx * 20, cy + 14)]
        else:
            pts = [(cx + sx * 14, cy - 8), (cx + sx * 60, cy - 20), (cx + sx * 104, cy - 6), (cx + sx * 122, cy + 30), (cx + sx * 98, cy + 22), (cx + sx * 82, cy + 40), (cx + sx * 64, cy + 24), (cx + sx * 44, cy + 34), (cx + sx * 20, cy + 16)]
        f.part(poly(*pts), mem, k=8)
        d = ImageDraw.Draw(f.img); bone = tone(hx(wc), -0.15)
        for p_ in pts[2:8:2]:
            d.line((cx + sx * 16, cy - 2, p_[0], p_[1]), fill=bone, width=5)
    f.part(union(ell(cx, cy + 2, 24, 26), poly((cx - 20, cy - 16), (cx - 26, cy - 46), (cx - 6, cy - 22)), poly((cx + 20, cy - 16), (cx + 26, cy - 46), (cx + 6, cy - 22))), wc, k=8)
    f.part(ell(cx, cy + 12, 14, 14), '#c8a8f0', k=5)
    d = ImageDraw.Draw(f.img)
    for ex in (cx - 10, cx + 10):
        d.ellipse((ex - 6, cy - 10, ex + 6, cy + 2), fill=hx('#ff4040')); d.ellipse((ex - 3, cy - 8, ex, cy - 5), fill=(255, 220, 220))
    for fx_ in (cx - 7, cx + 4):
        d.polygon([(fx_, cy + 10), (fx_ + 4, cy + 10), (fx_ + 2, cy + 18)], fill=(255, 255, 255))
    return f.final()

def skel(fr):
    f = Fig(64, 64, '#2a2420'); W, H = f.W, f.H
    bone = '#ece6d4'; base = H - 6
    X = lambda x: W / 2 + (x - 128); Y = lambda y: base - (250 - y)
    if fr == 0: fk, ff, bk, bf = (150, 200), (168, 246), (112, 202), (90, 246)
    else:       fk, ff, bk, bf = (138, 198), (138, 246), (124, 198), (128, 240)
    # 盾（うしろの腕）
    f.part(ell(X(92), Y(150), 30, 34), '#8a5a2e', k=8)
    f.part(ell(X(92), Y(150), 10, 12), '#b8b0a0', k=4)
    # うしろの脚
    f.part(union(cap(X(124), Y(170), X(bk[0]), Y(bk[1]), 6), cap(X(bk[0]), Y(bk[1]), X(bf[0]), Y(bf[1] - 6), 5)), tone(hx(bone), -0.12), k=4)
    f.part(ell(X(bf[0] + 6), Y(bf[1] - 3), 14, 6), tone(hx(bone), -0.12), k=3)
    # 背骨・あばら・こし
    f.part(cap(X(130), Y(104), X(128), Y(166), 6), bone, k=4)
    d0 = lambda d: [d.arc((X(108), Y(106 + i * 14), X(160), Y(132 + i * 14)), 200, 340, fill=255, width=9) for i in range(4)]
    f.part(d0, bone, k=3)
    f.part(union(ell(X(128), Y(170), 22, 12)), bone, k=4)
    f.part(rrect(X(104), Y(160), X(154), Y(172), 4), '#6a4a2a', k=3)    # ぼろぬのの腰まき
    f.part(poly((X(108), Y(170)), (X(150), Y(170)), (X(146), Y(198)), (X(130), Y(186)), (X(116), Y(200))), '#5a6a3a', k=5)
    # 前の脚
    f.part(union(cap(X(134), Y(172), X(fk[0]), Y(fk[1]), 6), cap(X(fk[0]), Y(fk[1]), X(ff[0]), Y(ff[1] - 6), 5)), bone, k=4)
    f.part(ell(X(ff[0] + 6), Y(ff[1] - 3), 14, 6), bone, k=3)
    # 頭
    hx_, hy = X(136), Y(72)
    f.part(union(ell(hx_, hy, 30, 28), rrect(hx_ - 8, hy + 10, hx_ + 26, hy + 34, 8)), bone, k=8)
    d = ImageDraw.Draw(f.img)
    d.ellipse((hx_ + 2, hy - 8, hx_ + 20, hy + 12), fill=hx('#1a1210')); d.ellipse((hx_ + 8, hy - 2, hx_ + 14, hy + 4), fill=hx('#ff5a3a'))
    d.polygon([(hx_ + 22, hy + 10), (hx_ + 28, hy + 18), (hx_ + 20, hy + 18)], fill=hx('#1a1210'))
    for i in range(4): d.line((hx_ + 2 + i * 7, hy + 22, hx_ + 2 + i * 7, hy + 32), fill=hx('#5a5040'), width=3)
    f.part(union(ell(hx_ - 6, hy - 18, 28, 14), rrect(hx_ - 34, hy - 18, hx_ + 22, hy - 8, 4)), '#7a828e', k=6)    # さびたかぶと
    # 前の腕と剣
    hand = (X(178), Y(140))
    f.part(union(cap(X(140), Y(108), X(156), Y(128), 5), cap(X(156), Y(128), hand[0], hand[1], 5)), bone, k=3)
    f.part(union(poly((hand[0] - 2, hand[1] - 6), (hand[0] + 6, hand[1] - 92), (hand[0] + 16, hand[1] - 96), (hand[0] + 12, hand[1] - 4))), '#a8a090', k=5)
    f.part(rrect(hand[0] - 14, hand[1] - 6, hand[0] + 22, hand[1] + 2, 2), '#8a6a3a', k=2)
    f.part(ell(hand[0] + 4, hand[1] + 2, 7, 7), bone, k=3)
    return f.final()

def wiz(fr):
    f = Fig(64, 60, '#140c24'); W, H = f.W, f.H
    base = H - 4; X = lambda x: W / 2 + (x - 128); Y = lambda y: base - (236 - y)
    robe = '#3a2470'
    # 杖（うしろ）
    f.part(cap(X(178), Y(232), X(186), Y(40), 4), '#5a3a1e', k=3)
    f.part(union(poly((X(172), Y(46)), (X(186), Y(14)), (X(200), Y(46)), (X(186), Y(54)))), '#8a8a9a', k=4)
    f.part(ell(X(186), Y(34), 12, 12), '#b04ae8', k=4)
    d = ImageDraw.Draw(f.img); d.ellipse((X(180), Y(26), X(188), Y(34)), fill=(255, 220, 255))
    # 衣
    f.part(poly((X(98), Y(86)), (X(150), Y(84)), (X(172), Y(230)), (X(160), Y(222)), (X(148), Y(234)), (X(134), Y(222)), (X(120), Y(234)), (X(106), Y(222)), (X(88), Y(232)), (X(76), Y(224))), robe, k=10)
    d = ImageDraw.Draw(f.img); dk = tone(hx(robe), -0.12)
    for x0, x1 in ((112, 98), (126, 124), (140, 150)): d.line((X(x0), Y(110), X(x1), Y(222)), fill=dk, width=5)
    f.part(poly((X(102), Y(128)), (X(152), Y(126)), (X(150), Y(138)), (X(104), Y(140))), '#d4a83a', k=3)   # 帯
    # フード
    f.part(union(ell(X(126), Y(70), 38, 40), poly((X(90), Y(60)), (X(70), Y(110)), (X(100), Y(96)))), robe, k=10)
    f.part(ell(X(136), Y(76), 24, 26), '#0c0614', shade=False, k=3)
    d = ImageDraw.Draw(f.img)
    for ex in (X(130), X(148)):
        d.ellipse((ex - 6, Y(70), ex + 6, Y(80)), fill=hx('#ffd84a')); d.ellipse((ex - 2, Y(72), ex + 2, Y(76)), fill=(255, 255, 255))
    # 腕と手
    f.part(union(taper(X(140), Y(98), 12, X(168), Y(128), 10)), robe, k=6)
    f.part(ell(X(178), Y(130), 8, 8), '#9a90a8', k=3)
    return f.final()

if __name__ == '__main__':
    out = sys.argv[1]
    from PIL import Image
    tiles = [slime(0), slime(1), bat(0), bat(1), skel(0), skel(1), wiz(0)]
    o = Image.new('RGBA', (sum(t.width + 6 for t in tiles), 64), (90, 170, 70, 255)); x = 0
    for t in tiles: o.alpha_composite(t, (x, 64 - t.height)); x += t.width + 6
    o.resize((o.width * 4, o.height * 4), Image.NEAREST).save(out)
