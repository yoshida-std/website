# 人のキャラ（右向きの歩き2コマ・正面の決めポーズ）を、勇者に合わせた絵で描く
import sys; sys.path.insert(0, sys.path[0])
from px import *

SKIN = '#f2c29a'

def face_side(f, cx, cy, sp, eye='#3b6fb0', brow='#5a3a20', beard=None, old=False):
    d = ImageDraw.Draw(f.img)
    # 目（白目・ひとみ・光）
    ex, ey = cx + 13, cy + 3
    if old:
        d.line((ex - 5, ey, ex + 4, ey - 1), fill=hx('#3a2418'), width=3)
    else:
        d.ellipse((ex - 6, ey - 8, ex + 5, ey + 8), fill=(255, 255, 255))
        d.ellipse((ex - 3, ey - 7, ex + 5, ey + 7), fill=hx(eye))
        d.ellipse((ex - 1, ey - 3, ex + 4, ey + 5), fill=hx('#1a1420'))
        d.ellipse((ex - 2, ey - 6, ex + 1, ey - 2), fill=(255, 255, 255))
    d.line((ex - 7, ey - 12, ex + 6, ey - 13), fill=hx(brow), width=4)
    # 口
    d.line((cx + 16, cy + 18, cx + 21, cy + 17), fill=tone(hx(SKIN), -0.32), width=2)
    # ほお
    d.ellipse((cx + 4, cy + 9, cx + 12, cy + 14), fill=tone(hx(SKIN), -0.03, 0.15, -0.02))

def head_side(f, cx, cy, sk=SKIN, r=27):
    f.part(ell(cx, cy, r, r), sk, k=6)
    f.part(ell(cx + 6, cy + 10, r - 8, r - 10), sk, k=4)   # あご
    f.part(ell(cx - 8, cy + 4, 5, 7), sk, k=3)             # 耳

def hair_side(f, cx, cy, col, style):
    r = 27
    top = ell(cx - 4, cy - 18, r + 5, 16)                    # 頭のてっぺん（まゆより上まで）
    bang = poly((cx + 2, cy - 26), (cx + 26, cy - 10), (cx + 20, cy - 4), (cx + 10, cy - 12), (cx + 4, cy - 6), (cx - 2, cy - 14))   # 前髪
    back = poly((cx - 28, cy - 12), (cx - 26, cy + 18), (cx - 14, cy + 22), (cx - 8, cy - 6))   # 耳のうしろ
    if style == 'short':
        f.part(union(top, bang, back), col, k=7)
    elif style == 'long':
        f.part(union(top, bang, poly((cx - 28, cy - 12), (cx - 32, cy + 44), (cx - 8, cy + 40), (cx - 8, cy - 6))), col, k=7)
    elif style == 'bob':
        f.part(union(top, bang, poly((cx - 28, cy - 12), (cx - 28, cy + 26), (cx - 6, cy + 24), (cx - 6, cy - 6))), col, k=7)
    elif style == 'kid':
        f.part(union(top, bang, back, poly((cx - 6, cy - 30), (cx + 2, cy - 42), (cx + 8, cy - 28))), col, k=7)
    d = ImageDraw.Draw(f.img); dk = tone(hx(col), -0.16)
    for a0, b0 in ((-18, -26), (-6, -30), (6, -28)):
        d.line((cx + a0, cy + b0, cx + a0 - 6, cy + b0 + 14), fill=dk, width=3)

def beard_side(f, cx, cy, col):
    f.part(union(poly((cx - 4, cy + 10), (cx + 24, cy + 14), (cx + 20, cy + 36), (cx + 6, cy + 42), (cx - 6, cy + 26))), col, k=6)
    f.part(ell(cx + 18, cy + 14, 7, 3), col, k=2)   # 口ひげ

# 頭にかぶるもの
def headgear_side(f, cx, cy, kind, c1, c2=None):
    if kind == 'horn_helm':
        f.part(union(poly((cx - 2, cy - 24), (cx - 22, cy - 32), (cx - 36, cy - 50), (cx - 30, cy - 26), (cx - 12, cy - 10))), '#efe2c4', k=5)
        f.part(union(ell(cx - 1, cy - 16, 27, 17), rrect(cx - 27, cy - 16, cx + 25, cy - 6, 4)), c1, k=8)
        f.part(rrect(cx - 28, cy - 11, cx + 26, cy - 5, 3), c2 or '#c89b4a', k=3)
    elif kind == 'wizard_hat':
        f.part(poly((cx - 24, cy - 14), (cx + 22, cy - 16), (cx + 4, cy - 56), (cx - 18, cy - 78), (cx - 8, cy - 52)), c1, k=8)
        f.part(poly((cx - 23, cy - 16), (cx + 21, cy - 18), (cx + 18, cy - 26), (cx - 20, cy - 24)), c2 or '#e2b445', k=3)
        f.part(poly((cx - 46, cy - 14), (cx + 42, cy - 18), (cx + 48, cy - 10), (cx - 42, cy - 6)), c1, k=5)
    elif kind == 'mitre':
        f.part(union(poly((cx - 18, cy - 10), (cx + 18, cy - 12), (cx + 12, cy - 44), (cx, cy - 56), (cx - 12, cy - 44))), c1, k=7)
        f.part(union(rrect(cx - 2, cy - 46, cx + 4, cy - 16, 1), rrect(cx - 10, cy - 36, cx + 12, cy - 30, 1)), c2 or '#e2b445', k=2)
        f.part(rrect(cx - 20, cy - 14, cx + 20, cy - 6, 3), c2 or '#e2b445', k=3)
    elif kind == 'cap':
        f.part(union(ell(cx - 2, cy - 18, 26, 14), poly((cx + 14, cy - 14), (cx + 38, cy - 10), (cx + 36, cy - 6), (cx + 12, cy - 6))), c1, k=6)
    elif kind == 'helm':
        f.part(union(ell(cx - 1, cy - 16, 27, 17), rrect(cx - 27, cy - 16, cx + 25, cy - 6, 4)), c1, k=8)
        f.part(rrect(cx - 28, cy - 11, cx + 26, cy - 5, 3), c2 or '#8c96a6', k=3)
        f.part(poly((cx - 6, cy - 30), (cx - 2, cy - 42), (cx + 4, cy - 30)), '#c23b2e', k=3)
    elif kind == 'turban':
        f.part(union(ell(cx - 2, cy - 18, 28, 17)), c1, k=8)
        f.part(union(cap(cx - 26, cy - 10, cx + 24, cy - 16, 4)), c2 or '#c98a2a', k=3)
        f.part(ell(cx + 10, cy - 18, 5, 6), '#d8323f', k=2)
    elif kind == 'crown':
        f.part(poly((cx - 20, cy - 14), (cx + 20, cy - 16), (cx + 22, cy - 36), (cx + 12, cy - 26), (cx + 2, cy - 42), (cx - 8, cy - 26), (cx - 20, cy - 36)), '#f0c23a', k=4)
        for x in (cx - 8, cx + 2, cx + 12):
            f.part(ell(x, cy - 20, 3, 3), '#d8323f', shade=False, stroke=False)
    elif kind == 'tiara':
        f.part(poly((cx - 14, cy - 18), (cx + 16, cy - 20), (cx + 10, cy - 32), (cx + 2, cy - 26), (cx - 6, cy - 34)), '#f0c23a', k=3)
        f.part(ell(cx + 2, cy - 24, 3, 3), '#5ac8f0', shade=False, stroke=False)

# 持ち物（右手）
def weapon_side(f, kind, hx_, hy, t=0):
    if kind == 'axe':
        f.part(cap(hx_ - 22, hy + 22, hx_ + 26, hy - 30, 3), '#8a5a2e', k=3)
        f.part(union(poly((hx_ + 18, hy - 22), (hx_ + 46, hy - 40), (hx_ + 52, hy - 12), (hx_ + 32, hy - 6))), '#c9d0da', k=6)
    elif kind == 'staff_orb':
        f.part(cap(hx_ + 2, hy + 60, hx_ + 6, hy - 50, 3), '#8a5a2e', k=3)
        f.part(union(ell(hx_ + 6, hy - 58, 10, 10)), '#e2b445', k=3)
        f.part(ell(hx_ + 6, hy - 58, 7, 7), '#e8463a', k=3)
    elif kind == 'crosier':
        f.part(cap(hx_ + 2, hy + 60, hx_ + 6, hy - 46, 3), '#e2b445', k=3)
        f.part(union(cap(hx_ + 6, hy - 46, hx_ + 6, hy - 70, 3), cap(hx_ - 6, hy - 60, hx_ + 18, hy - 60, 3)), '#e2b445', k=3)
    elif kind == 'spear':
        f.part(cap(hx_ - 10, hy + 64, hx_ + 10, hy - 70, 3), '#8a5a2e', k=3)
        f.part(poly((hx_ + 8, hy - 66), (hx_ + 16, hy - 70), (hx_ + 14, hy - 96)), '#d6dce4', k=4)
    elif kind == 'scepter':
        f.part(cap(hx_, hy + 30, hx_ + 8, hy - 30, 3), '#f0c23a', k=3)
        f.part(ell(hx_ + 9, hy - 36, 7, 7), '#5ac8f0', k=3)
    elif kind == 'pack':
        pass

def person_side(spec, frame, cellw=48, cellh=48, scale=1.0):
    f = Fig(cellw, cellh, spec.get('line', '#2a1a14'))
    W, H = f.W, f.H
    g = lambda v: v * scale
    ox, base = W / 2 - g(96), H - 4   # 足もと
    X = lambda x: ox + g(x)
    Y = lambda y: base - g(188 - y)
    R = lambda r: g(r)
    hipX, hipY, shY = 96, 124, 84
    legc, bootc = spec.get('legs', '#5a4a3a'), spec.get('boots', '#6a4428')
    if frame == 0:
        fk, ff, bk, bf = (116, 154), (132, 184), (82, 156), (62, 184)
    else:
        fk, ff, bk, bf = (100, 154), (98, 184), (96, 150), (104, 176)
    dress = spec.get('torso') in ('robe', 'dress')
    lean = spec.get('lean', 5)
    # マント（うしろ）
    if spec.get('cape'):
        sway = 6 if frame == 0 else -2
        f.part(poly((X(84), Y(82)), (X(100), Y(84)), (X(84), Y(126)), (X(64 + sway), Y(170)), (X(52 + sway), Y(158)), (X(66), Y(112))), tone(hx(spec['cape']), -0.06), k=8)
    # うしろの腕
    f.part(union(taper(X(88 + lean), Y(90), R(9), X(78), Y(110), R(7)), taper(X(78), Y(110), R(7), X(86), Y(126), R(6))), tone(hx(spec['sleeve']), -0.08), k=5)
    f.part(ell(X(87), Y(129), R(6), R(6)), tone(hx(SKIN), -0.08), k=3)
    # うしろの脚
    if not dress:
        f.part(union(taper(X(hipX - 4), Y(hipY), R(10), X(bk[0]), Y(bk[1]), R(8)), taper(X(bk[0]), Y(bk[1]), R(8), X(bf[0]), Y(bf[1] - 8), R(7))), tone(hx(legc), -0.1), k=6)
        f.part(union(ell(X(bf[0] + 4), Y(bf[1] - 4), R(11), R(7)), rrect(X(bf[0] - 6), Y(bf[1] - 22), X(bf[0] + 8), Y(bf[1] - 2), R(4))), tone(hx(bootc), -0.1), k=5)
    # 体
    t = spec.get('torso')
    if dress:
        sw = 5 if frame == 0 else -3
        hem = 178 if t == 'robe' else 176
        f.part(poly((X(80), Y(shY)), (X(112), Y(shY - 2)), (X(118), Y(118)), (X(128 + sw), Y(hem)), (X(62 + sw), Y(hem + 2)), (X(76), Y(118))), spec['body'], k=9)
        d = ImageDraw.Draw(f.img); dk = tone(hx(spec['body']), -0.13)
        for x0, x1 in ((90, 80 + sw), (104, 104 + sw), (112, 120 + sw)):
            d.line((X(x0), Y(132), X(x1), Y(hem - 6)), fill=dk, width=4)
        if spec.get('trim'):
            f.part(poly((X(64 + sw), Y(hem - 6)), (X(128 + sw), Y(hem - 8)), (X(128 + sw), Y(hem)), (X(62 + sw), Y(hem + 2))), spec['trim'], k=3)
        if spec.get('apron'):
            f.part(poly((X(98), Y(112)), (X(118), Y(112)), (X(124 + sw), Y(166)), (X(100 + sw), Y(168))), spec['apron'], k=4)
        # 足先
        f.part(ell(X(ff[0] + 6 + sw), Y(186), R(10), R(5)), bootc, k=3)
    else:
        f.part(union(poly((X(80 + lean), Y(shY)), (X(114 + lean), Y(shY - 2)), (X(112), Y(hipY + 4)), (X(80), Y(hipY + 6))), ell(X(98 + lean), Y(shY + 8), R(18), R(12))), spec['body'], k=9)
        if spec.get('chest'):
            f.part(poly((X(90 + lean), Y(shY + 4)), (X(114 + lean), Y(shY + 2)), (X(112), Y(hipY - 8)), (X(92), Y(hipY - 6))), spec['chest'], k=6)
        if spec.get('skirt'):
            sw = 4 if frame == 0 else -2
            f.part(poly((X(80), Y(hipY - 4)), (X(112), Y(hipY - 6)), (X(120 + sw), Y(hipY + 24)), (X(74 + sw), Y(hipY + 26))), spec['skirt'], k=6)
        f.part(rrect(X(80), Y(hipY - 4), X(113), Y(hipY + 4), R(2)), spec.get('belt', '#5a3a20'), k=3)
        f.part(rrect(X(97), Y(hipY - 5), X(105), Y(hipY + 5), R(1)), '#e2b445', k=2)
        # 前の脚
        f.part(union(taper(X(hipX + 6), Y(hipY + 2), R(10), X(fk[0]), Y(fk[1]), R(8)), taper(X(fk[0]), Y(fk[1]), R(8), X(ff[0]), Y(ff[1] - 8), R(7))), legc, k=6)
        f.part(union(ell(X(ff[0] + 5), Y(ff[1] - 3), R(12), R(7)), rrect(X(ff[0] - 7), Y(ff[1] - 24), X(ff[0] + 8), Y(ff[1] - 2), R(4))), bootc, k=5)
    if spec.get('shoulder'):
        f.part(ell(X(104 + lean), Y(shY + 4), R(14), R(11)), spec['shoulder'], k=6)
    if spec.get('pack'):
        f.part(rrect(X(62), Y(78), X(84), Y(114), R(6)), spec['pack'], k=7)
    # 頭
    hcx, hcy = X(100 + lean), Y(54)
    hr = R(27)
    if spec.get('hairBack'):
        f.part(union(ell(hcx - R(4), hcy + R(4), R(24), R(26)), poly((hcx - R(26), hcy), (hcx - R(30), hcy + R(56)), (hcx + R(2), hcy + R(52)))), spec['hair'], k=7)
    head_side(f, hcx, hcy, r=hr)
    face_side(f, hcx, hcy, None, eye=spec.get('eye', '#3b6fb0'), brow=tone(hx(spec.get('hair', '#5a3a20')), -0.15) if spec.get('hair') else hx('#5a3a20'), old=spec.get('old', False))
    if spec.get('beard'):
        beard_side(f, hcx, hcy, spec['beard'])
    if spec.get('hairStyle'):
        hair_side(f, hcx, hcy, spec['hair'], spec['hairStyle'])
    if spec.get('hat'):
        headgear_side(f, hcx, hcy, spec['hat'], spec.get('hatCol', '#8c96a6'), spec.get('hatCol2'))
    # 前の腕と持ち物
    hand = (X(128), Y(118))
    f.part(union(taper(X(104 + lean), Y(90), R(10), X(116), Y(108), R(8)), taper(X(116), Y(108), R(8), hand[0], hand[1], R(7))), spec['sleeve'], k=5)
    if spec.get('weapon'):
        weapon_side(f, spec['weapon'], hand[0], hand[1])
    f.part(ell(hand[0], hand[1], R(7), R(7)), SKIN, k=3)
    return f.final()


def face_front(f, cx, cy, eye='#3b6fb0', brow='#5a3a20', old=False):
    d = ImageDraw.Draw(f.img)
    for sx in (-1, 1):
        ex, ey = cx + sx * 10, cy + 4
        if old:
            d.line((ex - 5, ey, ex + 5, ey), fill=hx('#3a2418'), width=3)
        else:
            d.ellipse((ex - 5, ey - 8, ex + 5, ey + 8), fill=(255, 255, 255))
            d.ellipse((ex - 4, ey - 7, ex + 4, ey + 7), fill=hx(eye))
            d.ellipse((ex - 2, ey - 3, ex + 2, ey + 5), fill=hx('#1a1420'))
            d.ellipse((ex - 3, ey - 6, ex, ey - 3), fill=(255, 255, 255))
        d.line((ex - 6, ey - 12, ex + 6, ey - 12), fill=hx(brow), width=4)
    d.arc((cx - 7, cy + 10, cx + 7, cy + 20), 20, 160, fill=tone(hx(SKIN), -0.32), width=3)   # 笑った口

def person_front(spec, cellw=48, cellh=60):
    f = Fig(cellw, cellh, spec.get('line', '#2a1a14'))
    W, H = f.W, f.H
    cx = W / 2; base = H - 4
    Y = lambda y: base - (236 - y)
    dress = spec.get('torso') in ('robe', 'dress')
    if spec.get('cape'):
        f.part(poly((cx - 22, Y(110)), (cx + 22, Y(110)), (cx + 34, Y(212)), (cx - 34, Y(212))), tone(hx(spec['cape']), -0.08), k=8)
    if not dress:
        for sx in (-1, 1):
            f.part(union(taper(cx + sx * 10, Y(170), 10, cx + sx * 18, Y(222), 8)), spec.get('legs', '#5a4a3a'), k=6)
            f.part(union(ell(cx + sx * 20, Y(228), 11, 7), rrect(cx + sx * 20 - 9, Y(206), cx + sx * 20 + 9, Y(228), 4)), spec.get('boots', '#6a4428'), k=5)
        f.part(union(poly((cx - 20, Y(110)), (cx + 20, Y(110)), (cx + 17, Y(172)), (cx - 17, Y(172))), ell(cx, Y(118), 24, 14)), spec['body'], k=9)
        if spec.get('chest'):
            f.part(poly((cx - 15, Y(114)), (cx + 15, Y(114)), (cx + 12, Y(156)), (cx - 12, Y(156))), spec['chest'], k=6)
        if spec.get('skirt'):
            f.part(poly((cx - 18, Y(164)), (cx + 18, Y(164)), (cx + 24, Y(190)), (cx - 24, Y(190))), spec['skirt'], k=6)
        f.part(rrect(cx - 18, Y(164), cx + 18, Y(172), 2), spec.get('belt', '#5a3a20'), k=3)
        f.part(rrect(cx - 4, Y(163), cx + 4, Y(173), 1), '#e2b445', k=2)
    else:
        f.part(poly((cx - 20, Y(108)), (cx + 20, Y(108)), (cx + 34, Y(226)), (cx - 34, Y(226))), spec['body'], k=9)
        if spec.get('apron'):
            f.part(poly((cx - 9, Y(130)), (cx + 9, Y(130)), (cx + 14, Y(222)), (cx - 14, Y(222))), spec['apron'], k=4)
        if spec.get('trim'):
            f.part(poly((cx - 33, Y(218)), (cx + 33, Y(218)), (cx + 34, Y(226)), (cx - 34, Y(226))), spec['trim'], k=3)
        for sx in (-1, 1):
            f.part(ell(cx + sx * 16, Y(230), 10, 6), spec.get('boots', '#6a4428'), k=3)
    if spec.get('shoulder'):
        for sx in (-1, 1): f.part(ell(cx + sx * 22, Y(116), 12, 10), spec['shoulder'], k=6)
    # 左腕（腰に手）
    f.part(union(taper(cx - 22, Y(116), 8, cx - 34, Y(140), 7), taper(cx - 34, Y(140), 7, cx - 20, Y(160), 6)), spec['sleeve'], k=5)
    f.part(ell(cx - 20, Y(160), 6, 6), SKIN, k=3)
    # 頭
    hy = Y(78)
    if spec.get('hairBack'):
        f.part(union(ell(cx, hy + 4, 30, 30), rrect(cx - 30, hy, cx + 30, hy + 52, 10)), spec['hair'], k=7)
    f.part(ell(cx, hy, 26, 26), SKIN, k=6)
    face_front(f, cx, hy, eye=spec.get('eye', '#3b6fb0'), brow=tone(hx(spec.get('hair', '#5a3a20')), -0.15), old=spec.get('old', False))
    if spec.get('beard'):
        f.part(union(poly((cx - 22, hy + 6), (cx + 22, hy + 6), (cx + 16, hy + 40), (cx, hy + 48), (cx - 16, hy + 40))), spec['beard'], k=6)
        f.part(ell(cx, hy + 13, 12, 4), spec['beard'], k=2)
    if spec.get('hairStyle'):
        f.part(union(ell(cx, hy - 20, 29, 13), poly((cx - 29, hy - 16), (cx - 27, hy + 14), (cx - 20, hy - 4)), poly((cx + 29, hy - 16), (cx + 27, hy + 14), (cx + 20, hy - 4)), poly((cx - 14, hy - 22), (cx - 4, hy - 10), (cx + 4, hy - 18), (cx + 14, hy - 10), (cx + 18, hy - 22))), spec['hair'], k=7)
    hat = spec.get('hat'); c1 = spec.get('hatCol', '#8c96a6'); c2 = spec.get('hatCol2', '#c89b4a')
    if hat == 'horn_helm':
        for sx in (-1, 1): f.part(poly((cx + sx * 18, hy - 22), (cx + sx * 34, hy - 32), (cx + sx * 40, hy - 54), (cx + sx * 30, hy - 26), (cx + sx * 14, hy - 12)), '#efe2c4', k=5)
        f.part(union(ell(cx, hy - 16, 28, 18), rrect(cx - 28, hy - 16, cx + 28, hy - 6, 4)), c1, k=8)
        f.part(rrect(cx - 29, hy - 11, cx + 29, hy - 5, 3), c2, k=3)
    elif hat == 'wizard_hat':
        f.part(poly((cx - 24, hy - 14), (cx + 24, hy - 14), (cx + 6, hy - 64), (cx + 22, hy - 82), (cx - 4, hy - 60)), c1, k=8)
        f.part(poly((cx - 24, hy - 16), (cx + 24, hy - 16), (cx + 21, hy - 26), (cx - 21, hy - 26)), c2, k=3)
        f.part(poly((cx - 46, hy - 14), (cx + 46, hy - 14), (cx + 40, hy - 6), (cx - 40, hy - 6)), c1, k=5)
    elif hat == 'mitre':
        f.part(poly((cx - 20, hy - 12), (cx + 20, hy - 12), (cx + 14, hy - 46), (cx, hy - 58), (cx - 14, hy - 46)), c1, k=7)
        f.part(union(rrect(cx - 3, hy - 48, cx + 3, hy - 18, 1), rrect(cx - 11, hy - 38, cx + 11, hy - 32, 1)), c2, k=2)
        f.part(rrect(cx - 22, hy - 16, cx + 22, hy - 8, 3), c2, k=3)
    # 右腕（持ち物を高くかかげる）
    hand = (cx + 30, Y(66))
    f.part(union(taper(cx + 22, Y(116), 8, cx + 34, Y(92), 7), taper(cx + 34, Y(92), 7, hand[0], hand[1], 6)), spec['sleeve'], k=5)
    w = spec.get('weapon')
    if w == 'axe':
        f.part(cap(hand[0], hand[1] + 20, hand[0], hand[1] - 52, 3), '#8a5a2e', k=3)
        f.part(poly((hand[0] + 2, hand[1] - 50), (hand[0] + 24, hand[1] - 62), (hand[0] + 26, hand[1] - 30), (hand[0] + 2, hand[1] - 36)), '#c9d0da', k=6)
    elif w == 'staff_orb':
        f.part(cap(hand[0], hand[1] + 26, hand[0], hand[1] - 44, 3), '#8a5a2e', k=3)
        f.part(ell(hand[0], hand[1] - 52, 10, 10), '#e2b445', k=3); f.part(ell(hand[0], hand[1] - 52, 7, 7), '#e8463a', k=3)
    elif w == 'crosier':
        f.part(cap(hand[0], hand[1] + 26, hand[0], hand[1] - 50, 3), '#e2b445', k=3)
        f.part(cap(hand[0] - 12, hand[1] - 40, hand[0] + 12, hand[1] - 40, 3), '#e2b445', k=3)
    f.part(ell(hand[0], hand[1], 7, 7), SKIN, k=3)
    return f.final()

SPECS = {
  'warrior': dict(body='#c0473a', chest='#9aa4b4', sleeve='#9aa4b4', legs='#6e5a4a', boots='#5a3a24', shoulder='#b8c0cc', cape='#8a2a2a',
                  hat='horn_helm', hatCol='#9aa4b4', hatCol2='#d4a54a', hair='#b5562e', beard='#b5562e', weapon='axe', skirt='#7a3a2a', eye='#3a6a3a'),
  'mage': dict(torso='robe', body='#5a3aa8', trim='#e2b445', sleeve='#5a3aa8', legs='#3a2a5a', boots='#3a2a1a', hat='wizard_hat', hatCol='#4a2e96', hatCol2='#e2b445',
               hair='#e8c060', hairBack=True, hairStyle='long', weapon='staff_orb', eye='#8a3ab0'),
  'priest': dict(torso='robe', body='#f0ede4', apron='#3e9a5a', trim='#e2b445', sleeve='#f0ede4', legs='#3a2a1a', boots='#6a4428', hat='mitre', hatCol='#f0ede4', hatCol2='#e2b445',
                 hair='#6a4a2a', hairStyle='short', weapon='crosier', eye='#3b6fb0'),
  'town': dict(body='#5a9a4a', sleeve='#5a9a4a', legs='#7a5a3a', boots='#5a3a24', hat='cap', hatCol='#9a7a44', hair='#7a4a2a', hairStyle='short', eye='#5a3a20'),
  'child': dict(body='#d84a3a', sleeve='#d84a3a', legs='#4a5a8a', boots='#6a4428', hair='#d8762a', hairStyle='kid', eye='#3a6a3a'),
  'woman': dict(torso='dress', body='#e8789a', apron='#f6f2ea', trim='#c8506a', sleeve='#e8789a', boots='#6a3a2a', hair='#7a4220', hairBack=True, hairStyle='bob', eye='#5a3a20'),
  'merchant': dict(torso='robe', body='#3a6ab8', trim='#e2b445', sleeve='#3a6ab8', boots='#5a3a24', hat='turban', hatCol='#e8c040', hatCol2='#c98a2a', hair='#3a2a1a', pack='#8a5a2e', beard='#3a2a1a', eye='#3a2a1a'),
  'soldier': dict(body='#3a5aa8', chest='#3a5aa8', sleeve='#9aa4b4', legs='#5a5a6a', boots='#4a3a2a', hat='helm', hatCol='#9aa4b4', hatCol2='#7a8494', hair='#5a3a20', weapon='spear', shoulder='#9aa4b4', eye='#3b6fb0'),
  'princess': dict(torso='dress', body='#f08ab8', trim='#ffffff', sleeve='#f08ab8', boots='#c8506a', hat='tiara', hair='#f0b040', hairBack=True, hairStyle='bob', eye='#3b6fb0'),
  'king': dict(torso='robe', body='#b02a3a', trim='#f6f2ea', sleeve='#b02a3a', boots='#5a3a24', hat='crown', hair='#e8e4dc', hairStyle='short', beard='#f2efe8', weapon='scepter', old=True, cape='#b02a3a'),
}

if __name__ == '__main__':
    out = sys.argv[1]
    from PIL import Image
    tiles = []
    for k, sp in SPECS.items():
        if k == 'child':
            tiles += [person_side(sp, fr, 48, 36, scale=.72) for fr in (0, 1)]
        else:
            tiles += [person_side(sp, fr) for fr in (0, 1)]
        if k in ('warrior', 'mage', 'priest'):
            tiles.append(person_front(sp))
    Wt = sum(t.width + 4 for t in tiles)
    sheet = Image.new('RGBA', (Wt, 60), (90, 170, 70, 255)); x = 0
    for t in tiles: sheet.alpha_composite(t, (x, 60 - t.height)); x += t.width + 4
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(out)
