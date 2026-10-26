# website リポジトリ

GitHub Pages で公開しているリポジトリ（公開元は `main`）。
公開URL: `https://yoshida-std.github.io/website/`

- `games/` … ブラウザゲーム（Aitsu-bom, Taijiros-yan, umi, Mogurush）
- `tools/` … 制作ツール（ys_*）
- ビルドなし。各作品は基本的に `index.html` 1枚で完結する
- ルート・`games/`・`tools/` に一覧ページはない（URL直打ちでアクセス）

## 作業の進め方

- 作業ブランチ `claude/github-pages-repo-structure-i4wse5` → PR で `main` へ取り込む（PR #1〜#3 はマージ済み）
- PR がマージされたら、次の作業はブランチを `origin/main` から作り直してから始める（`git checkout -B <branch> origin/main`）。強制プッシュはしない
- 動作確認は Playwright（スマホ幅、例: iPhone 13 / SE）。音声を `fetch` するので `file://` ではなく `python3 -m http.server` で配信して開く
- スマホ向けゲームは、ダブルタップ拡大・ピンチ・スクロール・長押しの抑止を必ず入れる（Mogurush の冒頭のコードを参照）
- コピーライト表記は「©YoshidaStudio, ©PANICPUMPKIN」（絵文字の ©️ は使わない）

## 作品ごとのメモ

各作品の仕様・ファイル構成・既知のバグなどは、その作品のフォルダの `CLAUDE.md` に書く（そのフォルダで作業するときに読み込まれる）。

- `games/Mogurush/CLAUDE.md` … モグラッシュ！
