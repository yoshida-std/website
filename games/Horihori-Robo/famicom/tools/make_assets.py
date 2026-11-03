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

BG_FLOOR = pat(["00000000", "00000000", "00010000", "00000000",
                "00000000", "00000100", "00000000", "00000000"])
BG_WALL = pat(["22222222", "33332333", "33332333", "22222222",
               "32333333", "32333333", "32333333", "22222222"])
BG_BLANK = pat(["00000000"] * 8)

def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(SRC).convert('RGBA')
    chr_bg = bytearray()
    for t in (BG_BLANK, BG_FLOOR, BG_WALL):
        chr_bg += tile_bytes(t)
    chr_bg += bytes(4096 - len(chr_bg))
    chr_sp = bytearray()
    sprites = []
    for (r, c) in FRAMES:
        cell = sheet.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
        s = to_sprite16(cell)
        sprites.append(s)
        for t in sprite_tiles(s):
            chr_sp += t
    chr_sp += bytes(4096 - len(chr_sp))
    open(os.path.join(OUT, 'chr.bin'), 'wb').write(bytes(chr_bg + chr_sp))

    # ネームテーブル: 13x15マス(1マス=2x2タイル)。左に3タイル余白(=26タイル幅を中央寄せ)
    W, H = 13, 15
    nt = bytearray([1] * 960)
    for cy in range(H):
        for cx in range(W):
            wall = cx in (0, W - 1) or cy in (0, H - 1) or (cx % 2 == 0 and cy % 2 == 0)
            t = 2 if wall else 1
            for dy in range(2):
                for dx in range(2):
                    nt[(cy * 2 + dy) * 32 + 3 + cx * 2 + dx] = t
    nt += bytes(64)  # 属性テーブル(全部パレット0)
    # 衝突マップ: 1行16バイト x 16行(=256B)。範囲外は壁。(行<<4)|列 で引ける
    cm = bytearray([1] * 256)
    for cy in range(H):
        for cx in range(W):
            wall = cx in (0, W - 1) or cy in (0, H - 1) or (cx % 2 == 0 and cy % 2 == 0)
            cm[cy * 16 + cx] = 1 if wall else 0
    open(os.path.join(OUT, 'map.bin'), 'wb').write(bytes(cm))
    open(os.path.join(OUT, 'nametable.bin'), 'wb').write(bytes(nt))

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
