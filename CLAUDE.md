# CLAUDE.md

このリポジトリで作業する際の前提・規約。

## プロジェクト概要

「やることだけ」— 単一HTMLファイルで完結するToDo管理Webアプリ。詳細は以下を必ず参照する。

- [`docs/todo-app-spec.md`](docs/todo-app-spec.md) — 要件・データモデル・画面仕様・通知仕様・複数デバイス同期仕様（正のソース）
- [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md) — 技術スタックの決定内容と選定理由
- [`docs/todo-app-impl-plan.md`](docs/todo-app-impl-plan.md) — Phase 1実装計画（ディレクトリ構成・実装ステップ）

実装前に必ず該当セクションを読み、記憶や推測で仕様を判断しない。仕様が曖昧な場合は独自解釈で進めず、ユーザーに確認する。

## 実装状況

仕様書 8.7 の Phase 1（必須要件 2.1・追加要件 2.2・手動エクスポート/インポート 2.3 #11,#12）に加え、
Phase 2 のうち同期ファイル（File System Access API、仕様書 8.3.2）による自動同期まで実装済み
（`src/lib/logic/fileSync.ts` / `src/lib/stores/syncFileHandle.ts` / `src/lib/file-system-access.d.ts`）。
WebDAV（8.3.3）は未着手。

## 技術スタック（確定済み・変更時は要確認）

Svelte + Vite（SvelteKit不使用）／TypeScript／素のCSS + Svelte scoped style／Vitest + Testing Library／Svelte store（追加ライブラリなし）／npm。
理由と比較検討の経緯は `docs/todo-app-tech-stack.md` 参照。新たにライブラリ・パッケージ・フレームワークを追加する場合は、必ずユーザーに確認を取ってから導入する。

## 実装時の必須事項

- ビルド成果物は単一HTMLファイル（`dist/index.html`）であることが要件（仕様書 1.2）。実装完了時は Skill `build-singlefile` で検証する。
- 機能実装後は Skill `spec-check` で該当する仕様書セクションとの整合性を確認する。
- 以下の領域は専門のSubagentに実装・レビューを任せる（バグ・データ損失リスクが高いため）。
  - 「今日」タブの抽出・並び替え（仕様書 4.5） → Subagent `sort-logic`
  - 定期タスクの繰り返し判定（仕様書 3.2） → Subagent `recurrence-logic`
  - 複数端末同期のマージ・競合解決（仕様書 8.5） → Subagent `sync-merge`
- UI実装時は Skill `fixing-accessibility`（ARIA・キーボード操作・フォーカス管理）と `fixing-motion-performance`（アニメーション性能）を適用する。
- ロジックには Vitest のユニットテストを必ず添える（特に日付境界値・タイブレーク・マージの競合ケース）。

## Git

- Todo（タスク）ごとにコミットする。
- コミット前に `npm run build` / `npm run test` / `npm run check` を実行し、いずれも通過することを確認する。

## ドキュメント更新

- 作業の最後に、ソースコードの変更内容に合わせて `README.md` と本ファイルを更新する。
