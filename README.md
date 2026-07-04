# やることだけ

「自分の管理したい方法で管理しきれない」という課題を解決するための、シンプルなToDo管理アプリ。
優先度と日時範囲をもとに自動で並び替えられた「今日やるべきタスク」を、上から順にこなすだけで処理できることを目指す。

詳しい要件・仕様は [`docs/todo-app-spec.md`](docs/todo-app-spec.md)、技術選定の経緯は [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md)、実装計画は [`docs/todo-app-impl-plan.md`](docs/todo-app-impl-plan.md) を参照。

現状、仕様書 8.7 の Phase 1（必須要件・追加要件・手動エクスポート/インポート）に加え、Phase 2 のうち同期ファイル（File System Access API）による自動同期まで実装済み。WebDAV（8.3.3）は未着手。

## 特徴

- タイトル入力だけで即座にタスクを追加
- 優先度（必須／できれば）と日時範囲をもとに「今日」タブが自動ソート
- 「今日」「すべて」「完了」「定期タスク」の4タブ構成、各タブに件数表示
- ワンショットタスクと定期タスク（毎日／毎週／隔週）を一元管理
- ブラウザの `Notification API` による開始・締切通知
- データはブラウザのローカルストレージに保存し、開発者サーバには一切送信しない
- 手動エクスポート／インポート（プレビュー＋マージ／上書き選択）に対応
- 同期ファイル（File System Access API）による自動同期に対応。ユーザーが指定した1ファイルを介して、60秒間隔＋タブ復帰時にマージ・書き戻しを行う（Chromium系デスクトップブラウザのみ。非対応環境は手動エクスポート/インポートにフォールバック）。WebDAVによる自動同期は今後のPhase
- 単一HTMLファイルとしてビルドされ、サーバなしで動作する

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
src/
  main.ts                    エントリーポイント
  App.svelte                 ルートコンポーネント（状態オーケストレーション）
  vite-env.d.ts
  test-setup.ts               Vitestのセットアップ（jest-dom等）
  lib/
    types.ts                 データモデル型（Task/Recurrence/Completions/Prefs/SyncMeta/SyncFile）
    file-system-access.d.ts  File System Access API のアンビエント型宣言
    stores/                  localStorage連動のSvelte store（tasks/completions/prefs/syncMeta）
                             ＋ syncFileHandle（非永続・セッション内のみのFileSystemFileHandle保持）
    logic/                   日付・繰り返し判定・今日タブソート・通知判定・同期マージ・同期ファイル
                             読み書き（fileSync.ts）等のロジック（各*.test.ts併設）
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

- Subagent: `sort-logic` / `recurrence-logic` / `sync-merge` — 仕様上バグやデータ損失リスクが高い領域（今日タブの抽出/並び替え、定期タスクの繰り返し判定、複数端末同期のマージ）専門
- Skill: `build-singlefile` / `spec-check` — 単一HTMLビルドの検証、仕様との整合性チェック
- Skill: `fixing-accessibility` / `fixing-motion-performance` — アクセシビリティ・アニメーション性能の監査/修正
