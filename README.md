# やることだけ

「自分の管理したい方法で管理しきれない」という課題を解決するための、シンプルなToDo管理アプリ。
優先度と日時範囲をもとに自動で並び替えられた「今日やるべきタスク」を、上から順にこなすだけで処理できることを目指す。

詳しい要件・仕様は [`docs/todo-app-spec.md`](docs/todo-app-spec.md)、技術選定の経緯は [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md) を参照。

## 特徴

- タイトル入力だけで即座にタスクを追加
- 優先度（必須／できれば）と日時範囲をもとに「今日」タブが自動ソート
- ワンショットタスクと定期タスク（毎日／毎週／隔週）を一元管理
- ブラウザの `Notification API` による開始・締切通知
- データはブラウザのローカルストレージに保存し、開発者サーバには一切送信しない
- 手動エクスポート／インポート、および将来的な同期ファイル・WebDAVによる複数端末共有（詳細は仕様書 8章）
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
docs/                  要件・仕様書、技術スタック決定書
src/
  main.ts              エントリーポイント
  App.svelte           ルートコンポーネント
  vite-env.d.ts
  test-setup.ts         Vitestのセットアップ（jest-dom等）
index.html              Viteのエントリーテンプレート
vite.config.ts
tsconfig.json
.claude/
  agents/               ドメインロジック専門のSubagent
  skills/                開発支援用のSkill
```

## Claude Code向けの設定

このリポジトリには [Claude Code](https://claude.com/claude-code) 向けの設定を `.claude/` 配下に用意している。詳細は [`CLAUDE.md`](CLAUDE.md) を参照。

- Subagent: `sort-logic` / `recurrence-logic` / `sync-merge` — 仕様上バグやデータ損失リスクが高い領域（今日タブの抽出/並び替え、定期タスクの繰り返し判定、複数端末同期のマージ）専門
- Skill: `build-singlefile` / `spec-check` — 単一HTMLビルドの検証、仕様との整合性チェック
- Skill: `fixing-accessibility` / `fixing-motion-performance` — アクセシビリティ・アニメーション性能の監査/修正
