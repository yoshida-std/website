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
]
BG_FLOOR = pat(["00000000", "00000000", "00010000", "00000000",
                "00000000", "00000100", "00000000", "00000000"])
BG_WALL = pat(["22222222", "33332333", "33332333", "22222222",
               "32333333", "32333333", "32333333", "22222222"])
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

def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(SRC).convert('RGBA')
    chr_bg = bytearray()
    for t in (BG_BLANK, BG_FLOOR, BG_WALL):
        chr_bg += tile_bytes(t)
    for rx, ry in ((7.4, 5.6), (4.6, 3.6)):          # タイル3〜6=大、7〜10=小(左上,右上,左下,右下)
        for t in sprite_tiles(pit16(rx, ry)):
            chr_bg += t
    chr_bg += bytes(4096 - len(chr_bg))
    chr_sp = bytearray()
    sprites = []
    for (r, c) in FRAMES:
        cell = sheet.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
        s = to_sprite16(cell)
        sprites.append(s)
        for t in sprite_tiles(s):
            chr_sp += t
    # 文字(GAME OVER・PUSH START用)。色2(=パレットの「からだ」色)だけで描く。タイル24〜35(G A M E O V R P U S H T)
    for g in GLYPHS:
        chr_sp += tile_bytes([[2 if c == '1' else 0 for c in (row + '000')[:8]] for row in g] + [[0] * 8])
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
    # ネームテーブルの輪(上下2面=30マス行)での、各マス行(0〜29)の書き込み先アドレス
    addr = [0x2000 + k * 64 if k < 15 else 0x2800 + (k - 15) * 64 for k in range(30)]
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
