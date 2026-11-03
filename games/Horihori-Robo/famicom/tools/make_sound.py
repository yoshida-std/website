#!/usr/bin/env python3
"""音のデータ(音程表・BGM・効果音)を assets/sound.inc に書き出す。
BGM はこの作品用のオリジナル曲(ブラウザ版の曲そのものではない)。
音符: 1〜72 = ド(C2)から半音刻み(MIDI 36〜107)、0=休み。
曲のデータは「音符,長さ(フレーム)」の並び。$FF=曲の頭へ戻る、$FE=効果音の終わり。"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'assets', 'sound.inc')
CPU = 1789773.0
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def midi(name):
    n = NOTES[name[0]]
    i = 1
    if name[i] == '#': n += 1; i += 1
    return 12 * (int(name[i:]) + 1) + n

def idx(name):
    return midi(name) - 35          # C2(MIDI36)=1

def freq(m): return 440.0 * 2 ** ((m - 69) / 12.0)

def period(m, tri=False):
    t = round(CPU / ((32 if tri else 16) * freq(m))) - 1
    return max(0, min(2047, t))

lines = ['; 自動生成: tools/make_sound.py']
for label, tri, hi in (('perlo', 0, 0), ('perhi', 0, 1), ('trilo', 1, 0), ('trihi', 1, 1)):
    vals = [period(36 + k, tri) for k in range(72)]
    vals = [(v >> 8) if hi else (v & 255) for v in vals]
    lines.append(f'{label}:  .byte ' + ','.join(str(v) for v in vals))

def stac(seq, rest=2):
    """[(音名 or None, 8分音符の数)] → 「音符,長さ」。音の後ろに短い休みを入れてスタッカートにする"""
    out = []
    for name, e in seq:
        d = 12 * e
        if name is None:
            out += [0, d]
        else:
            out += [idx(name), d - rest, 0, rest]
    return out

# メロディ(8小節 = C Am F G C Am F G)。1小節=8分音符8つ
mel = [
    [('E5',1),('G5',1),('E5',1),('C5',1),('D5',1),('E5',1),('G5',2)],
    [('A4',1),('C5',1),('E5',1),('C5',1),('A4',1),('C5',1),('E5',2)],
    [('F5',1),('A5',1),('F5',1),('C5',1),('D5',1),('F5',1),('A5',2)],
    [('G5',1),('F5',1),('E5',1),('D5',1),('C5',1),('D5',1),('D5',2)],
    [('E5',1),('E5',1),('G5',1),('E5',1),('C6',1),('B5',1),('G5',2)],
    [('A5',1),('G5',1),('E5',1),('C5',1),('A4',2),('E5',2)],
    [('F5',1),('E5',1),('D5',1),('C5',1),('A4',2),('C5',2)],
    [('D5',1),('E5',1),('D5',1),('B4',1),('G4',2),('G5',2)],
]
bass_roots = [('C3','G3'), ('A2','E3'), ('F2','C3'), ('G2','D3')] * 2
mel_b = []
for bar in mel:
    assert sum(e for _, e in bar) == 8
    mel_b += stac(bar)
bass_b = []
for r, f in bass_roots:
    bass_b += stac([(r,1),(f,1)] * 4)
assert sum(mel_b[1::2]) == sum(bass_b[1::2]) == 8 * 96
lines.append('bgm_mel:  .byte ' + ','.join(str(v) for v in mel_b) + ',$FF')
lines.append('bgm_bass: .byte ' + ','.join(str(v) for v in bass_b) + ',$FF')

# 効果音(ふたつめの矩形波)。(音名, フレーム数)。None=休み
sfx = {
    'spawn':  [('C5',3),('E5',3),('G5',4)],
    'gold':   [('E6',3),('G6',3),('C7',8)],
    'clear':  [('C5',6),('E5',6),('G5',6),('C6',8),(None,3),('E6',6),('G6',6),('C7',24)],
    'miss':   [('G5',5),('E5',5),('C5',5),('G4',5),('C4',16)],
    'stomp':  [('C6',3),('G6',5)],
    'crush':  [('G3',4),('C3',10)],
    'watch':  [('C6',3),('E6',3),('G6',3),('C7',3),('G6',3),('C7',8)],
    'alert':  [('C4',5),(None,3),('C4',5),(None,3),('C4',5),(None,3),('C4',8)],
    'ladder': [('C4',3),('G3',4)],
    'fall':   [('E4',3),('C4',3),('G3',6)],
}
ids = ['dig', 'spawn', 'gold', 'clear', 'miss', 'stomp', 'crush', 'watch', 'alert', 'ladder', 'fall']
for name, seq in sfx.items():
    data = []
    for n, d in seq:
        data += [0 if n is None else idx(n), d]
    lines.append(f'sq_{name}: .byte ' + ','.join(str(v) for v in data) + ',$FE')
# 効果音の表(番号1〜): ふたつめの矩形波の曲、ノイズ(周期,音量,フレーム数)
noise = {'dig': (9, 7, 5), 'miss': (6, 8, 10), 'crush': (4, 12, 14), 'ladder': (8, 7, 6), 'fall': (10, 6, 6)}
lo, hi, nper, nvol, nlen = [], [], [], [], []
for name in ids:
    if name in sfx:
        lo.append(f'<sq_{name}'); hi.append(f'>sq_{name}')
    else:
        lo.append('0'); hi.append('0')
    p = noise.get(name)
    nper.append(p[0] if p else 0); nvol.append(p[1] if p else 0); nlen.append(p[2] if p else 0)
lines.append('sfxlo: .byte ' + ','.join(lo))
lines.append('sfxhi: .byte ' + ','.join(hi))
lines.append('nzper: .byte ' + ','.join(map(str, nper)))
lines.append('nzvol: .byte ' + ','.join(map(str, nvol)))
lines.append('nzlen: .byte ' + ','.join(map(str, nlen)))
for i, name in enumerate(ids, 1):
    lines.append(f'SFX_{name.upper()} = {i}')
open(OUT, 'w').write('\n'.join(lines) + '\n')
print('sound.inc ok, bgm frames', sum(mel_b[1::2]))
