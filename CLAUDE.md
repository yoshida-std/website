# website リポジトリ

GitHub Pages で公開しているリポジトリ（公開元は `main`）。
公開URL: `https://yoshida-std.github.io/website/`

- `games/` … ブラウザゲーム（Aitsu-bom, Taijiros-yan, umi, Mogurush, judge2, Susume-Yusha, Horihori-Robo）
- `tools/` … 制作ツール（ys_*。`ys_spriteSheetEditer` は すすめ！ゆうしゃ のキャラの絵のエディタ）
- `portfolio/` … ヨシダスタジオのポートフォリオサイト（下の「ポートフォリオ」）
- `common/line-promo/` … ゲームから LINE スタンプ／絵文字へ誘導する共通部品（下の「LINEスタンプ誘導」）
- ビルドなし。各作品は基本的に `index.html` 1枚で完結する
- ルート・`games/`・`tools/` に一覧ページはない（URL直打ちでアクセス）

## 作業の進め方

- 作業ブランチ `claude/github-pages-repo-structure-i4wse5` → PR で `main` へ取り込む（PR #1〜#4 はマージ済み）
- PR がマージされたら、次の作業はブランチを `origin/main` から作り直してから始める（`git checkout -B <branch> origin/main`）。強制プッシュはしない
- 動作確認は Playwright（スマホ幅、例: iPhone 13 / SE）。音声を `fetch` するので `file://` ではなく `python3 -m http.server` で配信して開く
- スマホ向けゲームは、ダブルタップ拡大・ピンチ・スクロール・長押しの抑止を必ず入れる（Mogurush の冒頭のコードを参照）
- コピーライト表記は「©YoshidaStudio, ©PANICPUMPKIN」（絵文字の ©️ は使わない）

## ゲームはプッシュ前に Artifact で確認（必ず守る）

`games/` のゲームを変更したときは、変更後のゲームを Artifact に置いてユーザーに遊んでもらい、**OK をもらってから** プッシュする。

1. 変更を作り、Playwright での動作確認を済ませてローカルでコミットする（まだプッシュしない）
2. そのゲームの `index.html` を Artifact で公開する。音声・画像など相対パスで読むファイルは `files` で同じパスに載せる（例: Mogurush は `sound/*.mp3`）。各ゲームの確認用 Artifact の URL はそのゲームの `CLAUDE.md` に書いておき、毎回その URL を更新する（`url` を渡して公開。新しい URL を作らない）
3. Artifact の URL と、何を変えたか・どこを見てほしいかを伝え、ユーザーの返事を待つ
4. OK が出たらプッシュする。直しを頼まれたら、直してから 2 に戻る

- ゲーム以外の変更（`CLAUDE.md`、`tools/` など）は Artifact での確認なしでプッシュしてよい
- 強制プッシュしない、PR は頼まれたときだけ作る、は今までどおり

## LINEスタンプ誘導（`common/line-promo/`）

- `line-sticker-promo.js` … 共通部品。ゲームに `<script src="../../common/line-promo/line-sticker-promo.js" data-keys="商品ID,商品ID"></script>` を入れると、緑の「LINEスタンプ」ボタンと一覧が出る。使い方は JS 冒頭のコメント。`data-match="文字"` で名前にその文字を含むものを全部出せ、`data-exclude="文字,文字"` でそこから外せる（すすめ！ゆうしゃ は `data-match="あいつ" data-exclude="あいつの犬"`）
- `sticker-catalog.json` … カタログ。キーは LINE STORE の商品ID（スタンプは数字、絵文字は英数字24桁）。着せ替えは対象外。手で編集しない
- カタログは `.github/workflows/update-sticker-catalog.yml` が毎日 9:00（日本時間）に作り直し、`main` にコミットする。Actions の画面から手動でも実行できる
  - `.github/scripts/build_sticker_catalog.py` が LINE STORE の作者ページ（日本語）を巡回する（旧 generate_list の処理を移したもの。CSV は作らない）
  - 巡回する作者は `.github/scripts/authors.json`（`sticker_id` と `emoji_id` を使う。`theme_id` は使わない）
  - ページを読めない、0件、前回より2割以上減った、のどれかなら取得失敗とみなして更新しない（Actions は失敗になる）
  - この作業環境からは LINE STORE に接続できない。動作確認はテスト用のサーバーを立て、環境変数 `LINE_STORE_BASE` と `REQUEST_INTERVAL=0` を指定して行う
  - `items` 以外の設定（title, button, pixelArt, autoShow）は既存のカタログの値を引き継ぐので、直すときは JSON の該当部分だけ書き換える

## ポートフォリオ（`portfolio/`）

段階的に作っている。今あるのはトップ・LINE スタンプ・ブラウザゲーム・キャラクターIP のページ。ツールは「準備中」でリンクなし。note はカードを置かず、トップの最新記事の欄で見せる。YouTube のショートもトップの欄で見せる（ナビの「note」はその欄 `#note` へのリンク）。

- `portfolio/index.html` … トップ（ヘッダー画像、LINEスタンプ・ゲーム・キャラクターIP・ツールのカードと、note の最新記事3件をサムネイル付きで）
  - ヘッダー画像は `portfolio/img/header.jpg`（1424×748）と `header-800.jpg`（スマホ用の縮小版）。PC では上下を少し切って低めに見せる（ロゴは中央なので切れない）
  - 記事は `portfolio/note/articles.json` を `fetch` して出す。0件・読めないときは記事の欄ごと出さない。日付は JSON の日付（日本時間）の文字をそのまま出す
  - `articles.json` は `.github/workflows/update-note-feed.yml` が3時間ごとに作り直して `main` にコミットする（`main` でスクリプトか workflow を変えたときと、Actions の画面から手動でも動く）。手で編集しない
  - `.github/scripts/build_note_feed.py` が `https://note.com/yoshida_std/rss` を読み、新しい順に最大10件を書き出す（標準ライブラリだけで動く）。読めない・0件なら更新しない（Actions は失敗になる）
  - この作業環境からは note.com に接続できない。動作確認はテスト用の RSS を `http.server` で配信し、環境変数 `NOTE_RSS` にその URL を指定して行う
  - note の下に「最新のショート」の欄（YouTube のショート6件。縦長のサムネイル、スマホは横にスワイプ）。`portfolio/youtube/videos.json` を `fetch` して出す。0件・読めないときは欄ごと出さない。押すとショートの URL（`/shorts/動画ID`）が開く
  - `videos.json` は `.github/workflows/update-youtube-feed.yml` が3時間ごとに作り直して `main` にコミットする（スクリプトか workflow を変えたときと、手動でも動く）。手で編集しない
  - `.github/scripts/build_youtube_feed.py` は2段構えで読む。(1) チャンネル（ID `UCnCCTBOk6s1M7PFz2q1VZCQ`）の**ショートだけの再生リスト**（ID の `UC` を `UUSH` に変えたもの。YouTube の非公式な仕組みで、**ときどき 404 を返す**）の RSS。(2) (1) が読めなければ、チャンネル全体の RSS（公式・最新15本）を読み、1本ずつ `https://www.youtube.com/shorts/動画ID` を開いてショートだけに絞る（ショートなら 200、そうでなければ `/watch` へ転送。判定できなかった動画は残す）。新しい順に最大12件を書き出す。どちらも読めない・0件なら更新しない（Actions は失敗になり、サイトは前回の一覧のまま）。実行ログに、どちらで読んだか・ショートの判定結果が出る。別の RSS を読むときは環境変数 `YOUTUBE_FEED`
  - ショートのサムネイル（RSS の画像）は左右に黒帯の付いた横長なので、CSS で中央を縦長（9:16）に切り出している（`.short-thumb img` の `object-fit: cover`）
  - この作業環境からは youtube.com に接続できない。動作確認はテスト用のサーバー（RSS（Atom）と `/shorts/動画ID` を返すもの）を立て、環境変数 `YOUTUBE_BASE`（と `REQUEST_INTERVAL=0`、`RETRY_WAIT=0`）を指定して行う
- `portfolio/charip/` … キャラクターIP。トップのカード（`is-ready`・バッジ「見る」）と全ページのナビから `charip/` へリンクしている（2026-10-29 公開）
  - **載せる IP は `portfolio/charip/charip.json` に書いたものだけ**（ゲームの `games.json` と同じ考え方。公開日の新しい順）。追加・公開・公開停止は Claude Code のエージェントに頼む（追加＝`items` に1件足して紹介ページを作る、停止＝消す）
  - 1件の項目: `id`、`name`、`aliases`（別名の配列。省略可。一覧と詳細に「別名: …」で出す）、`group`（省略可。`{"name": "たいじろうズ", "members": [{"name","color","image"}]}`。`image` は紹介ページからの相対パス。`data-ip-members` に並べる）、`kind`（`original`＝自発 / `opensource`＝オープンソース。一覧は2つの見出しに分かれる）、`creator.name`（提供元者。一覧と詳細に出す）、`description`、`path`（紹介ページ。`charip/` からの相対パス `taijiro/`）、`image`（一覧のサムネイル。透過GIFなど。`../img/charip/…`。枠に全体が収まる）、`thumbBg`（サムネイルの背景。`linear-gradient(...)` のみ。省略は空色）、`stickers`（`{"q": "絞り込みの文字"}`。`"type": "emoji"` で絵文字タブ）、`games`（`games.json` の `id` の配列。そこに載っているものだけボタンが出る）、`published`。`opensource` は `source`（`{"name": "…", "url": "https://…"}`。元ページ。例: あいつ → https://yosooi.jp/aitsu/）も書く
  - 紹介ページは IP ごとに `charip/<id>/index.html`。**名前・提供元者・スタンプ／ゲームへのボタン・元ページへのリンク・最新スタンプは共通部品 `charip/ip.js`**（`<body data-ip="id">` と `data-ip-name` `data-ip-by` `data-ip-source` `data-ip-links` `data-ip-stickers` の目印を置くと `charip.json` から埋める。使い方は JS 冒頭）。**雰囲気・配置・デザインは IP ごとにエージェントと相談しながら作る**（そのページの `<style>` に書く。共通の部品は `style.css` の `.ip-*`）。スタンプのボタンは `line/?q=…` を開く
  - 今あるのは「たいじろう」（`charip/taijiro/`。ユーザー提供のアニメGIF（`img/charip/taijiro.gif`、透過）を使った空色のページ。`games` に `taijiros-yan` を指定済みだが、`games.json` に載せるまでボタンは出ない）。たいじろう＝むらさき（ふつう「たいじろう」と呼ぶ）、「たいじろうズ」はみどり・ピンクを含むグループ名（名前は「みどり」「ピンク」で確定）。もう1つたいじろうのページには「たいじろうのはじまり」の欄（もとはふつうのネコ。動く絵本スタンプ第1話へリンク）がある（静的HTML、`img/charip/taijiro-cat.gif` `taijiro-mikan.gif`）。もう1つ「あいつ」（`charip/aitsu/`。オープンソース。提供元者は「よそおいさん」、元ページ https://yosooi.jp/aitsu/ へリンク。夜ふけの紺色のページ。「ヨシダスタジオの独自設定」の欄（帽子の下に耳？＝ネコ疑惑、ペット「あいつの犬」、AI生成版）は静的HTMLで、`img/charip/aitsu-*`。`games` は `susume-yusha`（隠れキャラ））。もう1つ「ちびうぱ」（`charip/chibiupa/`。自発。ウーパールーパー。「ウーパくん」をチビ化したキャラ。やわらかいピンクのページ。ゲームなし）。予定: 自発は「ウーパくん」
- `portfolio/games/index.html` … ブラウザゲームの一覧。**載せるゲームは `portfolio/games/games.json` に書いたものだけ**（`games/` のフォルダを巡回しない。制作中のゲームは書かなければ載らない）。公開日の新しい順（同じ日は書いた順）
  - スマホ（iPhone / Android）で開いたときだけ「ホーム画面に追加」の案内を出す（`#a2hs`。機種は UA で見分ける。ホーム画面から開いているときと PC では出さない）。ウェブページからは追加の画面を出せない（iOS には仕組みがない。Android の `beforeinstallprompt` は、そのゲーム自身のページでしか使えない）ので、案内だけ
  - **ゲームを公開するとき**: `games.json` の `items` に1件足す。取り下げるときは消す。`games/` のフォルダの名前・中身は変えない
  - 1件の項目: `id`、`title`、`description`、`path`（ゲームのフォルダ。このページからの相対パスで `../../games/フォルダ名/`）、`image`（サムネイル。このページからの相対パスで `../img/games/…jpg`）、`orientation`（スマホで遊ぶ向き。`landscape`＝横向き、`portrait`＝縦向き。省略すると向きは表示しない）、`published`（公開日 `YYYY-MM-DD`）
  - サムネイルは `portfolio/img/games/` の JPEG。ゲームのタイトル画面を Playwright で撮り、ボタン・コピーライト・LINE ボタンは隠している（`.sp-btn,.tag,.rule,.menu,.copy,.tBtns,.tCopy` を `display:none`）
  - 横向きのゲームは 960×504（枠の比率とほぼ同じ）。縦向きのゲームは、縦画面のスクリーンショット（例: iPhone 13 の 390×844 を 2 倍）をそのまま JPEG にすればよい。枠に全体が収まり、左右は同じ絵をぼかして敷く（CSS の `.game-thumb .bg`）
- `portfolio/line/index.html` … LINEスタンプ・絵文字の一覧。`common/line-promo/sticker-catalog.json` を `fetch` して表示（カタログが更新されれば自動で反映）。スタンプ／絵文字のタブ、名前の絞り込み（全角半角・カタカナひらがなを区別しない。空白区切りで AND）。20件ずつのページ送り。各アイテムの右上にリンク（LINE STORE の URL）をコピーするボタン。状態は `?type=emoji&q=…&p=2` で URL に残る
  - 並びはカタログの順（新しい順）。`Object.keys` だと数字のキーが小さい順になってしまうので、JSON の文字列からキーの順を拾っている
- 各ページの `<head>` に OGP（SNS で URL を共有したときのカード）。画像はヘッダー画像 `img/header.jpg`。SNS は相対パスを読めないので、`og:url`・`og:image` は `https://yoshida-std.github.io/website/portfolio/…` の絶対URLで書く。ページを足したら OGP も足す
- コピーライトは「©YoshidaStudio」のみ（PANICPUMPKIN は入れない）
- `portfolio/style.css` … 共通スタイル（PC・スマホ両対応、ダークモード対応）。HTML からは `style.css?v=番号` で読む。**CSS を変えたら全ページの番号を1つ上げる**（上げないと、ブラウザに残った古い CSS で表示が崩れる）
- ゲームではないので Artifact での確認は不要。動作確認はゲームと同じく `http.server` で配信して Playwright で見る（この環境からは LINE の画像サーバーに接続できないので、画像は表示されない）

## 作品ごとのメモ

各作品の仕様・ファイル構成・既知のバグなどは、その作品のフォルダの `CLAUDE.md` に書く（そのフォルダで作業するときに読み込まれる）。

- `games/Mogurush/CLAUDE.md` … モグラッシュ！
- `games/judge2/CLAUDE.md` … 天使と悪魔のジャッジ2
- `games/Horihori-Robo/CLAUDE.md` … ホリホリ・ロボバスター（縦スクロールの穴ほりアクション。制作中）
- `games/Susume-Yusha/CLAUDE.md` … すすめ！ゆうしゃ
