# ys_promptManager

AI指示文を管理するスマホ用ツール（`index.html` 1枚、IndexedDB 保存）。

- 確認用 Artifact: https://claude.ai/artifact/8FvreXpg1ZTfMZLRDi1EVC（更新は `url` を渡して公開）
- Artifact 用は `<title>` と `<style>` と body だけにしたファイルを作って公開する（画像コピー・共有は Artifact の枠内では効かない場合あり）
- 版の目印: `index.html` の `APP_VERSION`。**変更するたびに書き換える**（開いているアプリが、公開された `index.html` の `APP_VERSION` と比べて「新しい版があります」を出す。トップの「最新に更新」ボタンは、URL に `?v=時刻` を付けて開き直す）
- iPhone は画像と文を1回の書き込みで同時にクリップボードへ入れると `NotAllowedError` で断る（画像だけ・文だけなら通る）。そのためコピーは「① 画像→② 文」の2段階ボタン（`wireStep`）。複数画像は番号つきの1枚（`collage`）にまとめ、画像追加時に作り終えておく（押した瞬間に渡せるBlobでないと失敗しやすい）
