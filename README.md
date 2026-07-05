# MONOLYSTAR

「自分の管理したい方法で管理しきれない」という課題を解決するための、シンプルなToDo管理アプリ。
優先度と日時範囲をもとに自動で並び替えられた「今日やるべきタスク」を、上から順にこなすだけで処理できることを目指す。

詳しい要件・仕様は [`docs/todo-app-spec.md`](docs/todo-app-spec.md)、技術選定の経緯は [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md)、実装計画は [`docs/todo-app-impl-plan.md`](docs/todo-app-impl-plan.md) を参照。

現状、仕様書 8.7 の Phase 1（必須要件・追加要件・手動エクスポート/インポート）まで実装済み。複数端末間の自動同期機能（ファイル同期・WebDAV）は実装しない方針とした。
また、仕様書9章のPWA対応（ホーム画面追加・スタンドアロン起動・オフラインのアプリシェル表示）も実装済み。

## 特徴

- タイトル入力だけで即座にタスクを追加
- 優先度（必須／できれば）と日時範囲をもとに「今日」タブが自動ソート
- 「今日」「完了」「すべて」「定期タスク」の4タブ構成、各タブに件数表示
- 完了タブは直近10件を表示し、「さらに読み込む」で古い完了タスクを10件ずつ追加表示
- ワンショットタスクと定期タスク（毎日／毎週／隔週）を一元管理
- ユーザーが自由に使える目印（しおり／インデックスタブ）で「進行中・気になる」などの中間状態をマーク
- 紙メタファーに沿ったマイクロインタラクション（完了時の判子スタンプ、目印の貼付演出、並び替えのFLIPアニメ。いずれも `prefers-reduced-motion` 対応）
- ブラウザの `Notification API` による開始・締切通知
- データはブラウザのローカルストレージに保存し、開発者サーバには一切送信しない
- 手動エクスポート／インポート（プレビュー＋マージ／上書き選択）に対応
- ToDoリストのリセット（全タスクを一括削除。確認ステップあり）
- 単一HTMLファイルとしてビルドされ、サーバなしで動作する
- PWA対応。ホーム画面に追加してアイコンから起動、スタンドアロン表示、オフラインでのアプリシェル表示に対応（`manifest.webmanifest` / `sw.js` / アイコンは単一HTMLファイル要件の例外として別ファイル）

## 技術スタック

| 項目 | 選定 |
|---|---|
| フレームワーク | Svelte + Vite（SvelteKit不使用） |
| 単一HTML化 | vite-plugin-singlefile |
| 言語 | TypeScript |
| スタイリング | 素のCSS + Svelte scoped style |
| テスト | Vitest + @testing-library/svelte |
| 状態管理 | Svelte store（組み込み） |
| パッケージ管理 | npm |

選定理由の詳細は [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md) を参照。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

`http://localhost:5173` 等でブラウザから確認できる（開発時は `vite-plugin-singlefile` は無効化されており、通常のソースマップ付きビルドで動作する）。

## ビルド

```bash
npm run build
```

`dist/index.html` に、JS/CSSがすべてインライン化された単一HTMLファイルが出力される。
出力の検証は Skill `build-singlefile`（`.claude/skills/build-singlefile/`）を参照。

## テスト・型チェック

```bash
npm run test     # Vitest（1回実行）
npm run test:watch
npm run check     # svelte-check による型チェック
```

## プロジェクト構成

```
docs/                        要件・仕様書、技術スタック決定書、実装計画
public/                       単一HTML化されないPWA関連ファイル（例外的に別ファイル）
  manifest.webmanifest        Web App Manifest
  sw.js                       アプリシェルをキャッシュするService Worker
  icons/                      ホーム画面・スプラッシュ用アイコン（通常/maskable/apple-touch-icon）
src/
  main.ts                    エントリーポイント
  App.svelte                 ルートコンポーネント（状態オーケストレーション）
  vite-env.d.ts
  test-setup.ts               Vitestのセットアップ（jest-dom等）
  lib/
    types.ts                 データモデル型（Task/Recurrence/Completions/Prefs/SyncFile）
    stores/                  localStorage連動のSvelte store（tasks/completions/prefs）
    logic/                   日付・繰り返し判定・今日タブソート・通知判定・
                             手動インポートのマージ・エクスポート/インポートファイル形式
                             等のロジック（各*.test.ts併設）
    components/              Header/QuickAddBar/Tabs/TaskList/TaskCard/TaskFormModal/DataMenu/Toast
index.html                    Viteのエントリーテンプレート
vite.config.ts
tsconfig.json
.claude/
  agents/                    ドメインロジック専門のSubagent
  skills/                     開発支援用のSkill
```

## Claude Code向けの設定

このリポジトリには [Claude Code](https://claude.com/claude-code) 向けの設定を `.claude/` 配下に用意している。詳細は [`CLAUDE.md`](CLAUDE.md) を参照。

- Subagent: `sort-logic` / `recurrence-logic` / `sync-merge` — 仕様上バグやデータ損失リスクが高い領域（今日タブの抽出/並び替え、定期タスクの繰り返し判定、手動インポートのマージ）専門
- Skill: `build-singlefile` / `spec-check` — 単一HTMLビルドの検証、仕様との整合性チェック
- Skill: `fixing-accessibility` / `fixing-motion-performance` — アクセシビリティ・アニメーション性能の監査/修正
