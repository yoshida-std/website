# ホリホリ・ロボバスター ファミコン版

ブラウザ版(`../index.html`)をファミコン実機(NROM / マッパー0)向けに移植する作業フォルダ。

## ビルド
cc65(ca65/ld65)と Python3(Pillow)が必要。`make` で `build/horihori.nes` ができる(EverDrive N8 のSDカードへ)。
`assets/` は `tools/make_assets.py` が `../robo.png` から作る(CHR・背景・衝突マップ)。

## 確認(ヘッドレス)
`node tools/run_headless.mjs build/horihori.nes 出力prefix "right:40,down:30"`(jsnes が必要)で画面を書き出せる。

## 進捗
- 第1段階: 16x16キャラ表示、十字キー歩行、白/黄/赤のパレット違い
- 第2段階: 壁の当たり判定(衝突マップ 16x16)
- 第3段階: ブラウザ版と同じマス単位の歩行(マスの途中で逆向きに戻れる。通路に入りやすい)
