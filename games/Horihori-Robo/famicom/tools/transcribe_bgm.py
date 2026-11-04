#!/usr/bin/env python3
"""ブラウザ版のBGM(bgm.mp3)から、ファミコン用の2声(メロディ・ベース)を自動で採譜して assets/bgm_notes.json に書く。
numpy・scipy・ffmpeg が必要(ビルドには不要。結果の json だけあればよい)。
テンポ100(1拍0.6秒)、16分音符=0.15秒=9フレームの格子に並べる。音程は YIN で、メロディは260〜2200Hz、ベースは40〜260Hzの帯域から取る。
自動採譜なので、音の抜けや間違いが残る(ドラムや和音は拾っていない)。
使い方: python3 tools/transcribe_bgm.py ../bgm.mp3"""
import json, os, subprocess, sys, tempfile
import numpy as np
import scipy.io.wavfile as wf
import scipy.signal as sg

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'bgm.mp3')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'bgm_notes.json')
OFFSET, STEP, NS = 0.04, 0.15, 960     # 拍の位相(秒)、16分音符の長さ、ステップ数(60小節)

wav = os.path.join(tempfile.mkdtemp(), 'bgm.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', SRC, '-ac', '1', '-ar', '22050', wav], check=True)
sr, x = wf.read(wav)
x = x.astype(np.float32) / 32768

def band(x, lo, hi):
    return sg.sosfiltfilt(sg.butter(4, [lo, hi], btype='band', fs=sr, output='sos'), x)

def yin(frame, fmin, fmax, thr=0.15):
    tau_max, tau_min = int(sr / fmin), int(sr / fmax)
    w = len(frame) // 2
    d = np.zeros(tau_max + 2)
    for tau in range(tau_min, tau_max + 1):
        diff = frame[:w] - frame[tau:tau + w]
        d[tau] = np.dot(diff, diff)
    cm = np.ones_like(d)
    run = 0.0
    for tau in range(1, tau_max + 1):
        run += d[tau]
        cm[tau] = d[tau] * tau / run if run > 0 else 1
    cand = [t for t in range(tau_min, tau_max) if cm[t] < thr and cm[t] <= cm[t + 1] and cm[t] <= cm[t - 1]]
    if not cand:
        tau = tau_min + int(np.argmin(cm[tau_min:tau_max]))
        if cm[tau] > 0.35: return None
    else:
        tau = cand[0]
    if 1 < tau < tau_max:
        a, b, c = cm[tau - 1], cm[tau], cm[tau + 1]
        den = a - 2 * b + c
        if den != 0: tau = tau + 0.5 * (a - c) / den
    return sr / tau

def midi(f): return None if f is None else int(round(69 + 12 * np.log2(f / 440)))

def fold(v, lo, hi):
    if v is None: return None
    while v > hi: v -= 12
    while v < lo: v += 12
    return v

def clean(seq, gap=1):
    s = list(seq)
    for i in range(1, len(s) - 1):                    # 1歩だけの外れ値(前後が同じ音)
        if s[i] != s[i - 1] and s[i - 1] == s[i + 1] and s[i - 1] is not None: s[i] = s[i - 1]
    i = 0
    while i < len(s):                                 # 同じ音にはさまれた短い無声を埋める
        if s[i] is None:
            j = i
            while j < len(s) and s[j] is None: j += 1
            if 0 < i and j < len(s) and j - i <= gap and s[i - 1] == s[j]:
                for k in range(i, j): s[k] = s[i - 1]
            i = j
        else: i += 1
    return s

mel_sig, bass_sig = band(x, 260, 2200), band(x, 40, 260)
mel, bass = [], []
for k in range(NS):
    a = int((OFFSET + k * STEP + 0.03) * sr)
    if a + int(0.2 * sr) > len(x):
        mel.append(None); bass.append(None); continue
    mel.append(fold(midi(yin(mel_sig[a:a + int(0.11 * sr) + 2000], 260, 1500)), 60, 88))
    bass.append(fold(midi(yin(bass_sig[a:a + int(0.14 * sr) + 3000], 45, 250)), 36, 59))
json.dump({'step_frames': 9, 'mel': clean(mel), 'bass': clean(bass)}, open(OUT, 'w'))
print('wrote', OUT)
