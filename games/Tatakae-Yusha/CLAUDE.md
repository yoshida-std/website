# 戦え！ゆうしゃ（`games/Tatakae-Yusha/`）

ドラクエ10の戦闘「相撲システム」を発展させた、スマホ縦画面・ブラウザのソロゲーム（制作中。ポートフォリオにはまだ載せていない）。公開URL: `https://yoshida-std.github.io/website/games/Tatakae-Yusha/`
リポジトリ全体の作業ルールはルートの `CLAUDE.md` を参照。

プッシュ前の確認用 Artifact: `https://claude.ai/artifact/WwVmu9QYrayLdxw3Jn8GzQ`（変更のたびにこの URL を更新する。`index.html` と、`files` で `src/*.js` を同じパスで載せる。Artifact 側が外枠を付けるので、載せるときは `<!DOCTYPE>` `<html>` `<head>` `<body>` と charset・viewport の meta を外したコピーを使う）

設計書は `docs/new-sumo-system-design-v3.md`（現行DQ10の整理は `docs/dq10-sumo-system-spec.md`）。作業前に必ず読むこと。数値は【仮】で、調整前提。

## 構成（ビルドなし。ES モジュール）

- `prototype-2d.html` … 移行元のプロトタイプ（Canvas 2D、1ファイル）。**動作の基準として変更しない**
- `index.html` … 入口。DOM と CSS はプロトタイプと同じ。`src/main.js` を `type="module"` で読む
- `src/config.js` … CFG・視野（CAMS）・フリック感度・敵の種類。切りかえは `setCamKey` / `setFlickKey` / `setET`（import した変数は外から代入できないため）
- `src/screen.js` … キャンバス・画面の大きさ（CW/CH/DPR）・上のウィンドウの高さ。`onResize(f)` で ほかの描画も大きさを合わせる
- `src/logic.js` … 状態 `S`・入力 `inp`・`step()`。プロトタイプのコードをそのまま移したもの
- `src/render2d.js` … Canvas 2D の描画（プロトタイプのまま）
- `src/main.js` … スマホのブラウザ動作の抑止・ループ・上のウィンドウのボタン・`window.__sumo`
- `src/render3d.js` … Three.js（WebGL）の描画。#gl（夜空・壁・床・しるし・キャラ）→ #c（HUD。移行元の 2D のコード）の順に重ねる
- `src/backdrop3d.js` … 背景の 3D 版。夜空（カメラについてくる半球＋シェーダーのグラデーション）・星（ちかちか）・星座（`CONSTEL`）、闘技場を囲む輪（半径 38、高さ 16、40区画）の壁（アーチ・柱・塔・あかりの窓。1つのジオメトリにまとめる）、たいまつ（加算合成のスプライトで炎のゆらぎ）。空の色の範囲は画面の上はしの角度 `atan(HZ/F)` に合わせる。遺跡の大きさ・高さは `WALL_R / WALL_H / BAYS`
- `src/three-chars.js` … キャラの 3D モデル（`{obj, update}` の形。glTF に差し替えやすくする）
- Three.js は importmap で `https://cdn.jsdelivr.net/npm/three@0.186.1/+esm`、追加部品（太い線）は `three/addons/` → `…/three@0.186.1/examples/jsm/` から読む（バージョン固定）
- 箱モデルの形・アニメは `render2d.js` の `heroParts` / `allyParts` / `enemyParts`（部品のリストを返す）を 2D と WebGL で共用する
- Three.js は部品を作るときに `Math.random` を使うので、`withOwnRandom` で別の乱数に切りかえてから作る（ゲームの乱数の並びを変えないため）
- アンチエイリアスは DPR 2 以上では切っている（スマホで重くなるため）
- `tools/bot.js` … ボット（headless）。使い方は JS 冒頭。`node tools/bot.js --compare prototype-2d.html,index.html` で移行元と勝敗・時間・毎フレームの状態を比べる
- この作業環境からは cdn.jsdelivr.net に接続できない。確認は `npm i three@0.186.1` をスクラッチに入れ、ボットは環境変数 `THREE_DIR` にその `node_modules/three` を指定する（Playwright で CDN への要求をそこへ回す）

## 方針
- ゲームロジックは平面(x,z)の円。描画だけを差し替える。ロジック・数値(CFG)・入力処理は変更しない
- 返事・UI文言は日本語。ゲーム内の文字はひらがな中心、ドラクエ風の枠
- 作業は小さく分けて、段階ごとにコミットする。壊れたらすぐ戻せるようにする
- 新しい挙動を足したら、ボット(headless)のシミュレーションで確認できる形を残す

## 土俵と地面（ユーザー指示 2026-11-21）
- 土俵の大きさを2倍にした（`CFG.arena.R` 11→22。中心 `cx,cz` は同じ）。**移行元（`prototype-2d.html`、R=11）とは、ロジックの数値がこの1点だけ ちがう**。ボットで移行元と比べるときは、土俵の大きさのぶん結果が変わる。描画だけの確認は `index.html?r=2d` と `index.html` の比較（毎フレーム完全一致）で行う
- 地面は添付の参考画像（大きな石板の石畳、すりへり、金の輪ときざみの象がん、土俵の外に のぼり階段）に合わせた。`render3d.js` の床のシェーダー（石板の目地・ふちの面とり・石ごとの色むら・よごれ・土俵のあかるさ・金の輪・きざみ・放射線）と、土俵の外の階段（2段のメッシュ）、キャラの かげ。土俵のふちの金線 `r=R` が場外の目じるし
- 壁の輪は土俵に合わせて広げた（`backdrop3d.js` の `WALL_R=60 / WALL_H=22 / BAYS=64`）

## ロジックと描画の境目（注意）
- 敵の見た目は当たり判定 `e.r` の 1.4 倍（`render2d.js` の `ENEMY_LOOK`。ユーザー指示「2まわり大きく」）。ロジックの大きさは変えていない。タップ・フリックの判定範囲・頭上の表示・止めの演出も見た目に合わせる。このため移行元（`prototype-2d.html`）とはフリックの当たり方が少しちがう（ボットの完全一致の比較は `index.html?r=2d` と `index.html` で行う）
- `render` が敵の画面上の位置と大きさ `e.sx / sy / shw / shh / sc` を書き、入力（`enemyAt`・`tapLock`）と止めの演出（`launchEnemy`）が読む。描画を変えても同じ値を書くこと
- 止めの演出 `S.fly` は画面の座標（px/秒）で動く（`stepFx` が `CW/CH` を使う）
- `faceTo()`（描画の中）が、まほうつかい・敵の向き `yaw3` と歩きのアニメ `mv3 / ph3` を更新する。勇者の `yaw3` は `step` で決まり、カメラから見た向き
- カメラは「視線は水平・画像の中心を地平線 `HZ` へずらした」投影（`proj()`）。下に傾けたカメラではない

## スマホ必須対応
- viewport: user-scalable=no、viewport-fit=cover
- touch-action: none(キャンバス)、overscroll-behavior: none
- touchstart で preventDefault(ボタン・メニュー以外)。ダブルタップ拡大・ピンチ・長押しメニュー・スクロールを抑止
- 入力は pointer イベント。音は最初のタッチ後に初期化
- 表示が隠れたら自動で一時停止

## 重要な操作仕様(変えないこと)
- ロック式の相対操作: 上=おす、左右=まわりこみ、下=さがる、止める=ふんばる
- 速いフリック=剣を振る(向き自由)。敵に重ねた操作は移動にならない
- 敵の「いま！」(予告の最後0.4秒)のフリック=いなす。振った直後0.5秒はいなせない
- 「おす」0.3秒以上の間は剣を振れない。きりょくゲージ(いきぎれ)あり
- 敵を押し出しても勝てない。勝敗はHP制
- 勇者の足もとは画面の上から50%。視野は3段階(せまい/ふつう/ひろい)
- 上のウィンドウは右上のボタンで隠せる

## 描画の現状
- 勇者・まほうつかい・敵: ローポリの箱モデル(drawHero / drawAlly / drawEnemy)。向きは連続角度(yaw)
- 床・背景: Canvas 2D の手続き描画(夜の遺跡の闘技場)
- ダメージ数字・名前・HPバー: Canvas上に重ねて描く

## WebGL化（進め方）
0. ロジックを ES モジュールに分ける（描画は Canvas 2D のまま）… 済み
1. 床・カメラ（キャラは仮の円柱）… 済み（`src/render3d.js`・`src/three-chars.js`。`?r=2d` で移行元の描画、`?fps=1` でフレームレート表示）
2. 勇者 … 済み（`three-chars.js` の `BoxModel`。移行元の `heroParts` の部品リストから、毎フレーム 面のメッシュ1つと ふちの太い線（`LineSegments2`、太さ 0.032 は世界の長さ）1つを作る。キャラ1人あたり描画2回）
3. まほうつかい・敵・止めの演出 … 済み（`allyParts` / `enemyParts` から同じ `BoxModel` で描く。ふちの線の太さはモデルの大きさに合わせる。止めの演出は移行元と同じく画面の座標（px）で動くので、画面の座標の平行投影カメラ（`ortho`）で描き、移行元と同じ 0.38 のかたむきを付ける。浮かぶ文字は WebGL の上の HUD に描くので、飛んでいく敵より手前に出る（移行元とのちがい）)
4. 背景・仕上げ … 背景は済み（実測は下の「実測」）。最適化は実機の数字を見てから
5. ボットで移行前と比べる

将来（今回はやらない）: glTF モデル化、床・背景の画像素材、コマンド選択（設計書 §3）

## 実測（段階4の時点。この作業環境は GPU なしのソフトウェア描画なので、フレームレートは目安にならない）
- 描画の回数: 1フレーム約 21 回（`WebGLRenderingContext` の draw 呼び出しを数えた）
- JS のメモリ: 約 11MB
- ゲームのソース: 約 111KB（index.html と src/）。Three.js は CDN から（`three.module.js`＋`three.core.js` が gzip で約 420KB。CDN の `+esm` は縮めてあるのでもっと小さい）
- 実機では URL の最後に `?fps=1` を付けると右下にフレームレートが出る。重ければ、たいまつのスプライト（約 20 個）を減らす・壁の区画（`BAYS`）を減らす・描画の解像度（DPR 上限）を下げる、の順に試す
