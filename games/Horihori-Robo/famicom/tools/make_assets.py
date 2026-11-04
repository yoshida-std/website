#!/usr/bin/env python3
"""ブラウザ版のスプライトシート(robo.png)から、ファミコン用のCHRとネームテーブルを作る。
出力: assets/chr.bin(8KB: 前半4KB=背景, 後半4KB=スプライト), assets/nametable.bin(1KB),
      assets/preview.png(確認用の拡大図)
スプライトは16x16(8x8タイル4枚: 左上,右上,左下,右下の順)、3色+透明。
色番号: 1=ふち(こい紺) 2=からだ 3=アクセント。色はパレットで差し替える(白/黄/赤)。
"""
import sys, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, '..', 'robo.png')
OUT = os.path.join(ROOT, 'assets')
CELL = 128

# (行, 列) 元シートのコマ。0=正面 1=背面 2..5=右向き歩き4コマ(左はスプライト反転)
FRAMES = [(0, 0), (0, 4), (1, 0), (1, 2), (1, 4), (1, 6)]

def classify(r, g, b):
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    if lum < 105: return 1
    if lum > 185: return 2
    return 3

def to_sprite16(img):
    a = img.split()[3]
    bbox = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    img = img.crop(bbox)
    w, h = img.size
    H = 16
    W = max(1, round(w * H / h))
    W = min(W, 16)
    img = img.resize((W, H), Image.LANCZOS)
    out = [[0] * 16 for _ in range(16)]
    ox = (16 - W) // 2
    px = img.load()
    for y in range(H):
        for x in range(W):
            r, g, b, al = px[x, y]
            if al < 128: continue
            out[y][x + ox] = classify(r, g, b)
    return out

def tile_bytes(rows8):
    lo = bytearray(8); hi = bytearray(8)
    for y in range(8):
        for x in range(8):
            v = rows8[y][x]
            if v & 1: lo[y] |= 0x80 >> x
            if v & 2: hi[y] |= 0x80 >> x
    return bytes(lo + hi)

def sprite_tiles(px16):
    tiles = []
    for ty, tx in ((0, 0), (0, 8), (8, 0), (8, 8)):  # TL, TR, BL, BR
        tiles.append(tile_bytes([[px16[ty + y][tx + x] for x in range(8)] for y in range(8)]))
    return tiles

def pat(rows):
    return [[int(c) for c in r] for r in rows]

GLYPHS = [  # G A M E O V R (5x7)
    [".111.", "1...1", "1....", "1.111", "1...1", "1...1", ".111."],
    [".111.", "1...1", "1...1", "11111", "1...1", "1...1", "1...1"],
    ["1...1", "11.11", "1.1.1", "1...1", "1...1", "1...1", "1...1"],
    ["11111", "1....", "1....", "1111.", "1....", "1....", "11111"],
    [".111.", "1...1", "1...1", "1...1", "1...1", "1...1", ".111."],
    ["1...1", "1...1", "1...1", "1...1", "1...1", ".1.1.", "..1.."],
    ["1111.", "1...1", "1...1", "1111.", "1.1..", "1..1.", "1...1"],
    ["1111.", "1...1", "1...1", "1111.", "1....", "1....", "1...."],   # P (31)
    ["1...1", "1...1", "1...1", "1...1", "1...1", "1...1", ".111."],   # U (32)
    [".1111", "1....", "1....", ".111.", "....1", "....1", "1111."],   # S (33)
    ["1...1", "1...1", "1...1", "11111", "1...1", "1...1", "1...1"],   # H (34)
    ["11111", "..1..", "..1..", "..1..", "..1..", "..1..", "..1.."],   # T (35)
    [".111.", "1...1", "1..11", "1.1.1", "11..1", "1...1", ".111."],   # 0 (36)
    ["..1..", ".11..", "..1..", "..1..", "..1..", "..1..", ".111."],   # 1
    [".111.", "1...1", "....1", "...1.", "..1..", ".1...", "11111"],   # 2
    ["11111", "...1.", "..1..", "...1.", "....1", "1...1", ".111."],   # 3
    ["...1.", "..11.", ".1.1.", "1..1.", "11111", "...1.", "...1."],   # 4
    ["11111", "1....", "1111.", "....1", "....1", "1...1", ".111."],   # 5
    ["..11.", ".1...", "1....", "1111.", "1...1", "1...1", ".111."],   # 6
    ["11111", "....1", "...1.", "..1..", ".1...", ".1...", ".1..."],   # 7
    [".111.", "1...1", "1...1", ".111.", "1...1", "1...1", ".111."],   # 8
    [".111.", "1...1", "1...1", ".1111", "....1", "...1.", ".11.."],   # 9
    [".1111", "1....", "1....", "1....", "1....", "1....", ".1111"],   # C (46)
    ["1....", "1....", "1....", "1....", "1....", "1....", "11111"],   # L (47)
    ["11111", "1....", "1....", "1111.", "1....", "1....", "1...."],   # F (48)
]
_names = 'GAMEOVRPUSHT' + '0123456789' + 'CLF'
FONT = {c: GLYPHS[i] for i, c in enumerate(_names)}
FONT['I'] = ["11111", "..1..", "..1..", "..1..", "..1..", "..1..", "11111"]
FONT['Y'] = ["1...1", "1...1", ".1.1.", "..1..", "..1..", "..1..", "..1.."]
FONT['N'] = ["1...1", "11..1", "11..1", "1.1.1", "1..11", "1..11", "1...1"]
FONT['K'] = ["1...1", "1..1.", "1.1..", "11...", "1.1..", "1..1.", "1...1"]
FONT['©'] = [".111.", "1...1", "1.11.", "1.1.1", "1.11.", "1...1", ".111."]
FONT['D'] = ["1111.", "1...1", "1...1", "1...1", "1...1", "1...1", "1111."]
FONT['B'] = ["1111.", "1...1", "1...1", "1111.", "1...1", "1...1", "1111."]
FONT['J'] = ["..111", "...1.", "...1.", "...1.", "...1.", "1..1.", ".11.."]
FONT['Q'] = [".111.", "1...1", "1...1", "1...1", "1.1.1", "1..1.", ".11.1"]
FONT['W'] = ["1...1", "1...1", "1...1", "1.1.1", "1.1.1", "11.11", "1...1"]
FONT['X'] = ["1...1", "1...1", ".1.1.", "..1..", ".1.1.", "1...1", "1...1"]
FONT['Z'] = ["11111", "....1", "...1.", "..1..", ".1...", "1....", "11111"]
FONT['!'] = ["..1..", "..1..", "..1..", "..1..", "..1..", ".....", "..1.."]
FONT['+'] = [".....", "..1..", "..1..", "11111", "..1..", "..1..", "....."]
FONT['/'] = ["....1", "....1", "...1.", "..1..", ".1...", "1....", "1...."]
ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
ARROW = ["1....", "11...", "111..", "1111.", "111..", "11...", "1...."]
HUD_LETTERS = 'SCOREL' + 'IFTPAGD' + 'YNKHUM'   # 背景タイル 32〜50 の並び(51=©)
HUD_TILE = {c: 22 + i for i, c in enumerate('0123456789')}
HUD_TILE.update({c: 32 + i for i, c in enumerate(HUD_LETTERS)})
HUD_TILE['©'] = 51
HUD_TILE_ALL = {c: 22 + i for i, c in enumerate('0123456789')}
HUD_TILE_ALL.update({c: 52 + i for i, c in enumerate(ALPHA)})
HUD_TILE_ALL['\u00a9'] = 51

BIG_LETTERS = 'HORIBUSTE'
def big_letter(g):
    """5x7のグリフを2倍(10x14)にして16x16へ。右下にずらした影つき。4タイル(TL,TR,BL,BR)のバイト列を返す"""
    px = [[0] * 16 for _ in range(16)]
    on = [(x * 2 + dx, y * 2 + dy) for y, row in enumerate(g) for x, c in enumerate(row) if c == '1'
          for dx in (0, 1) for dy in (0, 1)]
    for (x, y) in on:                      # 影(色3)
        if x + 3 < 16 and y + 2 < 16: px[y + 2][x + 3] = 3
    for (x, y) in on:                      # 本体(色2)
        px[y][x + 1] = 2
    out = b''
    for ty in (0, 8):
        for tx in (0, 8):
            out += tile_bytes([row[tx:tx + 8] for row in px[ty:ty + 8]])
    return out
BG_FLOOR = pat(["00000000", "00000000", "00010000", "00000000",
                "00000000", "00000100", "00000000", "00000000"])
BG_WALL = pat(["22222222", "33332333", "33332333", "22222222",
               "32333333", "32333333", "32333333", "22222222"])
BG_GOAL = pat(["11113333", "11113333", "11113333", "11113333", "33331111", "33331111", "33331111", "33331111"])
BG_BLANK = pat(["00000000"] * 8)

def pit16(rx, ry):
    # 16x16の穴。ふち=色2(茶)、中=色1(こい色)、まわり=0(床)
    px = [[0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) / rx) ** 2 + ((y - 8.0) / ry) ** 2
            di = ((x - 7.5) / (rx - 1.6)) ** 2 + ((y - 8.0) / (ry - 1.6)) ** 2
            if di <= 1: px[y][x] = 1
            elif d <= 1: px[y][x] = 2
    return px

def disc(px, cx, cy, rx, ry, edge, fill):
    for y in range(16):
        for x in range(16):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1:
                di = ((x - cx) / (rx - 1)) ** 2 + ((y - cy) / (ry - 1)) ** 2
                px[y][x] = fill if di <= 1 else edge

def gold16():
    # 金塊の山: 3つの丸い塊。ふち=茶(2)、中=うす橙(3)、かげ=こい色(1)
    px = [[0] * 16 for _ in range(16)]
    disc(px, 4.5, 11.0, 4.6, 3.6, 2, 3)
    disc(px, 11.0, 11.0, 4.6, 3.6, 2, 3)
    disc(px, 7.8, 7.0, 4.6, 3.8, 2, 3)
    for (x, y) in ((6, 5), (7, 5), (3, 10), (10, 10)):
        px[y][x] = 1
    return px

def ladder16():
    # 壁にかけたハシゴ: レンガ(2/3)のうえに、こい色(1)の縦棒2本と横棒
    px = [[BG_WALL[y % 8][x % 8] for x in range(16)] for y in range(16)]
    for y in range(16):
        for x in (3, 4, 11, 12): px[y][x] = 1
    for y in (2, 6, 10, 14):
        for x in range(3, 13): px[y][x] = 1
    return px

def watch16():
    # ストップウォッチ(スプライト): ふち=1、文字盤=2、針=3
    px = [[0] * 16 for _ in range(16)]
    disc(px, 7.5, 9.0, 6.8, 6.8, 1, 2)
    for y in range(0, 3):
        for x in (6, 7, 8, 9): px[y][x] = 1
    for y in range(4, 10): px[y][7] = px[y][8] = 3
    for k in range(4): px[9 + k // 1 * 0][8 + k] = 3
    return px

def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(SRC).convert('RGBA')
    chr_bg = bytearray()
    for t in (BG_BLANK, BG_FLOOR, BG_WALL):
        chr_bg += tile_bytes(t)
    for rx, ry in ((7.4, 5.6), (4.6, 3.6)):          # タイル3〜6=大、7〜10=小(左上,右上,左下,右下)
        for t in sprite_tiles(pit16(rx, ry)):
            chr_bg += t
    chr_bg += tile_bytes(BG_GOAL)                     # タイル11=ゴールのチェッカー
    for t in sprite_tiles(gold16()): chr_bg += t      # タイル12〜15=金塊(左上,右上,左下,右下)
    for t in sprite_tiles(ladder16()): chr_bg += t    # タイル16〜19=ハシゴ
    # 表示帯(背景パレット1: 色1=黒、色2=白)。20=黒, 21=区切り線, 22〜31=数字0〜9, 32〜44=文字
    chr_bg += tile_bytes([[1] * 8 for _ in range(8)])
    chr_bg += tile_bytes([[1] * 8 for _ in range(7)] + [[2] * 8])
    for ch in '0123456789' + HUD_LETTERS + '©':
        g = FONT[ch]
        chr_bg += tile_bytes([[2 if c == '1' else 1 for c in (row + '000')[:8]] for row in g] + [[1] * 8])
    assert len(chr_bg) == 52 * 16
    # クリア画面用の全文字(背景パレットの色1=黒、色2=文字色)。52〜77=A〜Z、78='!'、79='+'、80='/'
    for ch in ALPHA + '!+/':
        g = FONT[ch]
        chr_bg += tile_bytes([[2 if c == '1' else 1 for c in (row + '000')[:8]] for row in g] + [[1] * 8])
    assert len(chr_bg) == 81 * 16
    # タイトルの大きな文字(16x16=4タイル。TL,TR,BL,BR)。81〜116。色2=本体、色3=影(背景パレット3: 黄と赤)
    for ch in BIG_LETTERS:
        chr_bg += big_letter(FONT[ch])
    # 表示帯の値(背景パレット1: 色1=黒、色2=白、色3=黄)。117〜126=黄色い数字0〜9、127=残機の頭、128=ハシゴ
    for ch in '0123456789':
        g = FONT[ch]
        chr_bg += tile_bytes([[3 if c == '1' else 1 for c in (row + '000')[:8]] for row in g] + [[1] * 8])
    HEAD = ['...22...', '...33...', '.333333.', '.333333.', '.313313.', '.333333.', '.333333.', '..3333..']
    LAD = ['.3....3.', '.322223.', '.3....3.', '.322223.', '.3....3.', '.322223.', '.3....3.', '.3....3.']
    for icon in (HEAD, LAD):
        chr_bg += tile_bytes([[1 if c == '.' else int(c) for c in row] for row in icon])
    assert len(chr_bg) == 129 * 16
    chr_bg += bytes(4096 - len(chr_bg))
    chr_sp = bytearray()
    sprites = []
    for (r, c) in FRAMES:
        cell = sheet.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
        s = to_sprite16(cell)
        sprites.append(s)
        for t in sprite_tiles(s):
            chr_sp += t
    # 文字(GAME OVER・PUSH START用)。色2(=パレットの「からだ」色)だけで描く。タイル24〜35(G A M E O V R P U S H T)、36〜45(数字0〜9)、46=C 47=L 48=F、52〜55=ストップウォッチ
    # 黒い四角の中に白い文字(ゲーム画面の上でも読める)。左に1ドットの余白。色1=黒、色2=文字色
    for g in GLYPHS:
        chr_sp += tile_bytes([[2 if c == '1' else 1 for c in ('0' + row + '00')[:8]] for row in g] + [[1] * 8])
    chr_sp += tile_bytes([[1] * 8 for _ in range(8)])  # タイル49=黒いだけ(文字の余白・空白)
    for g in (FONT['I'], ARROW):                       # タイル50=I、51=矢印(ポーズの選択)
        chr_sp += tile_bytes([[2 if c == '1' else 1 for c in ('0' + row + '00')[:8]] for row in g] + [[1] * 8])
    for t in sprite_tiles(watch16()): chr_sp += t     # タイル52〜55=ストップウォッチ(4の倍数から)
    chr_sp += bytes(8) + bytes([0xFF]) + bytes(7)      # タイル56=スプライト0(一番上の1行だけ白。表示帯の区切り線と重なって見えない)
    chr_sp += bytes(4096 - len(chr_sp))
    open(os.path.join(OUT, 'chr.bin'), 'wb').write(bytes(chr_bg + chr_sp))

    # 迷路: 13列 x 31行(1マス=16px)。1=壁。奇数列x奇数行が部屋、偶数x偶数は柱。
    # 行は 1行16バイト(範囲外の列13〜15は壁)。ROMに置き、画面に出る行だけ実行時に背景へ書く
    import random
    rnd = random.Random(1)
    W, H = 13, 31
    grid = [[1] * 16 for _ in range(H)]
    nodes = [(x, y) for y in range(1, H - 1, 2) for x in range(1, W - 1, 2)]
    for (x, y) in nodes: grid[y][x] = 0
    seen = {nodes[-1]}          # 一番下(スタート側)から掘り始める
    stack = [nodes[-1]]
    while stack:
        x, y = stack[-1] if rnd.random() < 0.5 else rnd.choice(stack)
        nb = [(x + dx, y + dy) for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2))
              if 1 <= x + dx < W - 1 and 1 <= y + dy < H - 1 and (x + dx, y + dy) not in seen]
        if not nb:
            stack.remove((x, y)); continue
        nx, ny = rnd.choice(nb)
        grid[(y + ny) // 2][(x + nx) // 2] = 0
        seen.add((nx, ny)); stack.append((nx, ny))
    for _ in range(int(len(nodes) * 0.5)):   # 壁を少し抜いて行き止まりを減らす
        x = rnd.randrange(1, W - 1); y = rnd.randrange(1, H - 1)
        if (x % 2) != (y % 2): grid[y][x] = 0
    for x in range(1, W - 1): grid[H - 2][x] = 0   # 一番下の通路は全部あける(スタート)
    open(os.path.join(OUT, 'map.bin'), 'wb').write(bytes(v for row in grid for v in row))
    # 背景の1行(32タイル)ごとの「どの列のマスか」。画面の左3タイル・右3タイルは床(255)
    colcell = bytes(255 if (c < 3 or c >= 29) else (c - 3) // 2 for c in range(32))
    open(os.path.join(OUT, 'colcell.bin'), 'wb').write(colcell)
    # ネームテーブルの輪(縦ミラーの1画面=15マス行)での、各マス行(0〜31)の書き込み先アドレス
    addr = [0x2000 + (r % 15) * 64 for r in range(32)]
    open(os.path.join(OUT, 'rowlo.bin'), 'wb').write(bytes(a & 255 for a in addr))
    open(os.path.join(OUT, 'rowhi.bin'), 'wb').write(bytes(a >> 8 for a in addr))
    print('maze rows', H)
    # 迷路の確認画像
    mz = Image.new('RGB', (W * 8, H * 8), (41, 160, 60))
    for y in range(H):
        for x in range(W):
            if grid[y][x]:
                for yy in range(8):
                    for xx in range(8): mz.putpixel((x * 8 + xx, y * 8 + yy), (200, 120, 40))
    mz.save(os.path.join(OUT, 'maze_preview.png'))

    # 表示帯(画面B=ネームテーブル$2400)。1行目は余白、2〜3行目に文字、4行目は区切り線
    nt = [20] * 960
    def put(row, col, text):
        for i, ch in enumerate(text):
            if ch != ' ': nt[row * 32 + col + i] = HUD_TILE[ch]
    put(1, 1, 'SCORE'); put(1, 14, 'LIFE'); put(1, 22, 'STOP')
    put(2, 1, 'STAGE'); put(2, 10, 'GOLD'); put(2, 19, 'LADDER')
    for c in range(32): nt[3 * 32 + c] = 21
    attr = [0x55] * 8 + [0] * 56               # 上の4タイル行はパレット1(黒地に白)
    open(os.path.join(OUT, 'hud.bin'), 'wb').write(bytes(nt) + bytes(attr))

    # タイトル画面。上の32pxは画面B(HIGH SCORE。静的)、その下の208px(13マス行)は画面Aの輪をスクロールで降ろす絵
    # 絵(13マス行x16マス列。1マス=2x2タイル)を、上のマス行から順に64バイトずつ(上タイル行32+下タイル行32)
    BIGT = {ch: 81 + 4 * i for i, ch in enumerate(BIG_LETTERS)}
    pic = [[0] * 32 for _ in range(26)]
    def ptext(row, col, text):
        for i, ch in enumerate(text):
            pic[row][col + i] = 20 if ch == ' ' else HUD_TILE_ALL[ch]
    def pbig(row, col, text):
        for i, ch in enumerate(text):
            if ch == ' ': continue
            b0 = BIGT[ch]
            pic[row][col + i * 2] = b0; pic[row][col + i * 2 + 1] = b0 + 1
            pic[row + 1][col + i * 2] = b0 + 2; pic[row + 1][col + i * 2 + 1] = b0 + 3
    for r in (2, 3, 11, 12):                     # 枠(ゲームの壁のブロック): 上・下
        for c in range(2, 30): pic[r][c] = 2
    for r in range(4, 11):                       # 枠: 左右
        for c in (2, 3, 28, 29): pic[r][c] = 2
    pbig(5, 8, 'HORIHORI')
    pbig(8, 5, 'ROBO BUSTER')
    ptext(19, 11, 'PUSH START')
    ptext(22, 6, '\u00a92026 YOSHIDASTUDIO')
    ptext(23, 9, '\u00a9PANICPUMPKIN')
    qpal = [[1] * 16 for _ in range(13)]        # マスごとのパレット(0=壁 1=白 2=点滅 3=黄)
    for r in (1, 5, 6):
        for c in range(1, 15): qpal[r][c] = 0
    for r in (2, 3, 4):
        for c in range(1, 15): qpal[r][c] = 0 if c in (1, 14) else 3
    for c in range(16): qpal[9][c] = 2
    tattr = bytearray(64)
    for r in range(13):
        for c in range(16):
            tattr[(r >> 1) * 8 + (c >> 1)] |= qpal[r][c] << ((((r & 1) << 1) | (c & 1)) * 2)
    open(os.path.join(OUT, 'titlepic.bin'), 'wb').write(bytes(v for row in pic for v in row) + bytes(tattr))
    # 上の表示帯(画面B $2400): 4タイル行。3行目に HIGH SCORE(数字は実行時に書く)、4行目はスプライト0が当たる黒
    bar = [20] * 960
    for i, ch in enumerate('HIGH SCORE'):
        if ch != ' ': bar[2 * 32 + 8 + i] = HUD_TILE_ALL[ch]
    for i in range(5): bar[2 * 32 + 19 + i] = 22
    open(os.path.join(OUT, 'titlebar.bin'), 'wb').write(bytes(bar) + bytes([0x55] * 8 + [0] * 56))

    # クリア画面(画面B)の属性: 16x16px(2タイル行)ごとのパレット。1=白 2=点滅(PUSH START) 3=黄
    # 文字を置く行(タイル行): 4,6=黄(見出し・ランク) 8,10=白 12=黄(PERFECT) 14,18=白 24=点滅
    qpal = [1] * 16
    for r, p in ((4, 3), (6, 3), (12, 3), (24, 2)):
        qpal[r // 2] = p
    rattr = bytearray(64)
    for qr in range(16):
        half = qpal[qr] * 5                            # 左右2マスとも同じパレット
        for bc in range(8):
            if (qr >> 1) * 8 + bc < 64:
                rattr[(qr >> 1) * 8 + bc] |= half << ((qr & 1) * 4)
    open(os.path.join(OUT, 'resattr.bin'), 'wb').write(bytes(rattr))

    # 確認用の拡大プレビュー(白・黄・赤の3パレット)
    pals = [{1: (16, 16, 80), 2: (255, 255, 255), 3: (120, 190, 255)},
            {1: (16, 16, 80), 2: (255, 224, 40), 3: (240, 140, 40)},
            {1: (16, 16, 80), 2: (230, 60, 50), 3: (255, 160, 80)}]
    Z = 8
    prev = Image.new('RGB', (len(sprites) * 16 * Z + 8, 3 * 16 * Z + 8), (41, 160, 60))
    for pi, pal in enumerate(pals):
        for si, s in enumerate(sprites):
            for y in range(16):
                for x in range(16):
                    v = s[y][x]
                    if not v: continue
                    for zy in range(Z):
                        for zx in range(Z):
                            prev.putpixel((si * 16 * Z + x * Z + zx, pi * 16 * Z + y * Z + zy), pal[v])
    prev.save(os.path.join(OUT, 'preview.png'))
    print('ok: tiles', len(FRAMES) * 4, 'sprite tiles')

main()
