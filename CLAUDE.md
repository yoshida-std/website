# website リポジトリ

GitHub Pages で公開しているリポジトリ（公開元は `main`）。
公開URL: `https://yoshida-std.github.io/website/`

- `games/` … ブラウザゲーム（Aitsu-bom, Taijiros-yan, umi, Mogurush, judge2, Susume-Yusha）
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

段階的に作っている。今あるのはトップと LINE スタンプのページだけ。ゲーム・ツールは「準備中」でリンクなし。note はカードを置かず、トップの最新記事の欄で見せる（ナビの「note」はその欄 `#note` へのリンク）。

- `portfolio/index.html` … トップ（ヘッダー画像、LINEスタンプ・ゲーム・ツールのカードと、note の最新記事3件をサムネイル付きで）
  - ヘッダー画像は `portfolio/img/header.jpg`（1424×748）と `header-800.jpg`（スマホ用の縮小版）。PC では上下を少し切って低めに見せる（ロゴは中央なので切れない）
  - 記事は `portfolio/note/articles.json` を `fetch` して出す。0件・読めないときは記事の欄ごと出さない。日付は JSON の日付（日本時間）の文字をそのまま出す
  - `articles.json` は `.github/workflows/update-note-feed.yml` が3時間ごとに作り直して `main` にコミットする（`main` でスクリプトか workflow を変えたときと、Actions の画面から手動でも動く）。手で編集しない
  - `.github/scripts/build_note_feed.py` が `https://note.com/yoshida_std/rss` を読み、新しい順に最大10件を書き出す（標準ライブラリだけで動く）。読めない・0件なら更新しない（Actions は失敗になる）
  - この作業環境からは note.com に接続できない。動作確認はテスト用の RSS を `http.server` で配信し、環境変数 `NOTE_RSS` にその URL を指定して行う
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
- `games/Susume-Yusha/CLAUDE.md` … すすめ！ゆうしゃ
