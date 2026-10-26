# website リポジトリ

GitHub Pages で公開しているリポジトリ（公開元は `main`）。
公開URL: `https://yoshida-std.github.io/website/`

- `games/` … ブラウザゲーム（Aitsu-bom, Taijiros-yan, umi, Mogurush）
- `tools/` … 制作ツール（ys_*）
- ビルドなし。各作品は基本的に `index.html` 1枚で完結する
- ルート・`games/`・`tools/` に一覧ページはない（URL直打ちでアクセス）

## 作業の進め方

- 作業ブランチ `claude/github-pages-repo-structure-i4wse5` → PR で `main` へ取り込む（PR #1〜#4 はマージ済み）
- PR がマージされたら、次の作業はブランチを `origin/main` から作り直してから始める（`git checkout -B <branch> origin/main`）。強制プッシュはしない
- 動作確認は Playwright（スマホ幅、例: iPhone 13 / SE）。音声を `fetch` するので `file://` ではなく `python3 -m http.server` で配信して開く
- スマホ向けゲームは、ダブルタップ拡大・ピンチ・スクロール・長押しの抑止を必ず入れる（Mogurush の冒頭のコードを参照）
- コピーライト表記は「©YoshidaStudio, ©PANICPUMPKIN」（絵文字の ©️ は使わない）

## プッシュ前の確認（必ず守る）

GitHub へ `git push` する前に、変更を Artifact で公開してユーザーに見てもらい、**OK をもらってから** プッシュする。

1. 変更を作り、Playwright での動作確認を済ませてローカルでコミットする（まだプッシュしない）
2. Artifact で確認用ページを公開する
   - ゲーム・ツールの変更: その作品の `index.html` をそのまま公開する。音声・画像など相対パスで読むファイルは `files` で同じパスに載せる（例: Mogurush は `sound/*.mp3`）。同じ作品は2回目から同じ Artifact を更新して、URL を変えない
   - それ以外（`CLAUDE.md` など文書だけの変更）: 変更点（追加・削除した行）がわかる確認用ページを公開する
3. Artifact の URL と、何を変えたか・どこを見てほしいかを伝え、ユーザーの返事を待つ
4. OK が出たらプッシュする。直しを頼まれたら、直してから 2 に戻る
- 強制プッシュしない、PR は頼まれたときだけ作る、は今までどおり

## 作品ごとのメモ

各作品の仕様・ファイル構成・既知のバグなどは、その作品のフォルダの `CLAUDE.md` に書く（そのフォルダで作業するときに読み込まれる）。

- `games/Mogurush/CLAUDE.md` … モグラッシュ！
