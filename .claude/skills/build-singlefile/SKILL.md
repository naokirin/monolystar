---
name: build-singlefile
description: Build the ToDo app with Vite and verify the output is a truly single, dependency-free HTML file (no external <script src>, <link rel=stylesheet>, or other local file references). Use after implementation changes and before considering a milestone done, since docs/todo-app-spec.md 1.2 requires a single-file distributable.
---

# 単一HTMLファイルのビルド検証

このアプリは `docs/todo-app-spec.md` 1.2 により「単一HTMLファイル」として配布することが要件。
`vite-plugin-singlefile` を使ってビルドした成果物が本当に単一ファイルとして自己完結しているかを毎回検証する。

## 手順

1. ビルドを実行する
   ```bash
   npm run build
   ```
2. 出力先（通常 `dist/index.html`）を確認する
   ```bash
   ls -la dist/
   ```
   - `dist/` に `index.html` 以外の `.js` / `.css` ファイルが残っていないか確認する（残っていればインライン化に失敗している）
   - `dist/manifest.webmanifest` / `dist/sw.js` / `dist/icons/*.png`（PWA対応、仕様書9章）は例外として存在してよい。これらは `public/` からそのままコピーされる想定で、`index.html` 本体からは `<link rel="manifest">` / `<link rel="apple-touch-icon">` で参照されるだけであり、JS/CSSのインライン化とは無関係。
3. `dist/index.html` の中身を検査する
   ```bash
   grep -nE '<script[^>]+src=|<link[^>]+rel=["'"'"']stylesheet' dist/index.html
   ```
   - ヒットした場合、Google Fonts CDN（`fonts.googleapis.com` / `fonts.gstatic.com`）由来の外部参照は仕様上許容（1.2/技術スタック決定書 3. フォント読み込み参照）。それ以外のローカルファイル参照や外部スクリプトが残っていれば NG。
4. ファイルサイズを確認する（極端な肥大化がないか）
   ```bash
   du -h dist/index.html
   ```
5. 可能であればブラウザで `dist/index.html` を `file://` プロトコルで直接開き、動作を確認する（同一ネットワーク上のサーバなしで動くことの確認）。

## 既知の注意点（`docs/todo-app-tech-stack.md` 参照）
- 開発時（`vite dev`）はソースマップ付きの非インライン化ビルドでデバッグし、`vite-plugin-singlefile` が有効なのはリリースビルドのみであることを前提とする。
- Google Fonts 以外の静的アセット（画像等）を `public/` に置いた場合はインライン化されないため、そもそも `public/` 配下にアセットを置かない方針を基本とする。ただし PWA 対応（`manifest.webmanifest` / `sw.js` / `icons/`）は Service Worker が `data:` URIで登録できない都合上、単一HTMLファイル要件（仕様書1.2）の明示的な例外として `public/` に置く（仕様書9章）。それ以外の用途で `public/` にアセットを追加していないか確認する。
