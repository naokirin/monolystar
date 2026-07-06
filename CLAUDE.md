# CLAUDE.md

このリポジトリで作業する際の前提・規約。

## プロジェクト概要

「MONOLYSTAR」— 単一HTMLファイルで完結するToDo管理Webアプリ。詳細は以下を必ず参照する。

- [`docs/todo-app-spec.md`](docs/todo-app-spec.md) — 要件・データモデル・画面仕様・通知仕様・複数デバイス同期仕様（正のソース）
- [`docs/todo-app-tech-stack.md`](docs/todo-app-tech-stack.md) — 技術スタックの決定内容と選定理由
- [`docs/todo-app-impl-plan.md`](docs/todo-app-impl-plan.md) — Phase 1実装計画（ディレクトリ構成・実装ステップ）

実装前に必ず該当セクションを読み、記憶や推測で仕様を判断しない。仕様が曖昧な場合は独自解釈で進めず、ユーザーに確認する。

## 実装状況

仕様書 8.7 の Phase 1（必須要件 2.1・追加要件 2.2・手動エクスポート/インポート 2.3 #11,#12）まで実装済み。
複数端末間の自動同期機能（ファイル同期・WebDAV、仕様書 8.3.2/8.3.3）は想定通りに動作しなかったため
機能として撤去し、実装しない方針とした。手動エクスポート/インポートのマージ・競合解決ロジック
（`src/lib/logic/merge.ts` / `src/lib/logic/syncFile.ts`）のみ残している。

加えて、ユーザーが自由に使える目印（`Task.marker`。しおり／インデックスタブ）と、紙メタファーに沿った
マイクロインタラクション（完了時の判子スタンプ・目印の貼付演出・並び替えのFLIP）を実装済み
（`src/lib/components/TaskCard.svelte` / `TaskList.svelte` / `src/lib/logic/motion.ts`。仕様書 3.1・4.7）。
`marker` は手動インポートのマージ（`merge.ts` の `CONTENT_FIELDS`）で `updatedAt` LWW に追従する。

PWA対応（仕様書9章）も実装済み。`public/manifest.webmanifest` / `public/sw.js` / `public/icons/` は
Service Worker が `data:` URIで登録できないための、単一HTMLファイル要件（仕様書1.2）に対する明示的な例外。
Service Workerはアプリシェルの network-first キャッシュを担う（詳細は仕様書9章）。

通知（仕様書5章）はPWAインストール後のstandalone表示（主にAndroid/Chrome）で `new Notification()` が
例外を投げる既知の制約に対応するため、`src/lib/logic/deliverNotification.ts` で有効なService Worker
registrationの有無を判定し、あれば `showNotification()`、なければ従来の `Notification` コンストラクタに
フォールバックする（仕様書5.4）。判定・発火はアプリが開いている間のみで、Pushによるバックグラウンド
配信には対応しない方針は変更していない。

「今日」タブの並び替え（仕様書4.5）は目印（`marker`）を最優先の第1段階とし、優先度→締切→開始日の
既存3段階をその後に続ける4段階構成（`src/lib/logic/todaySort.ts`）。

詳細入力フォーム（仕様書4.3）は既存タスクの編集時のみ自動保存に対応済み
（`src/lib/components/TaskFormModal.svelte`。変更を500msデバウンスして保存し、閉じる操作の直前に
デバウンス待ちの変更をフラッシュする）。新規追加時は従来通り「追加」ボタンで確定する。

## 技術スタック（確定済み・変更時は要確認）

Svelte + Vite（SvelteKit不使用）／TypeScript／素のCSS + Svelte scoped style／Vitest + Testing Library／Svelte store（追加ライブラリなし）／npm。
理由と比較検討の経緯は `docs/todo-app-tech-stack.md` 参照。新たにライブラリ・パッケージ・フレームワークを追加する場合は、必ずユーザーに確認を取ってから導入する。

## 実装時の必須事項

- ビルド成果物は単一HTMLファイル（`dist/index.html`）であることが要件（仕様書 1.2）。実装完了時は Skill `build-singlefile` で検証する。
- 機能実装後は Skill `spec-check` で該当する仕様書セクションとの整合性を確認する。
- 以下の領域は専門のSubagentに実装・レビューを任せる（バグ・データ損失リスクが高いため）。
  - 「今日」タブの抽出・並び替え（仕様書 4.5） → Subagent `sort-logic`
  - 定期タスクの繰り返し判定（仕様書 3.2） → Subagent `recurrence-logic`
  - 手動インポートのマージ・競合解決（仕様書 8.5） → Subagent `sync-merge`
- UI実装時は Skill `fixing-accessibility`（ARIA・キーボード操作・フォーカス管理）と `fixing-motion-performance`（アニメーション性能）を適用する。
- ロジックには Vitest のユニットテストを必ず添える（特に日付境界値・タイブレーク・マージの競合ケース）。

## Git

- Todo（タスク）ごとにコミットする。
- コミット前に `npm run build` / `npm run test` / `npm run check` を実行し、いずれも通過することを確認する。

## ドキュメント更新

- 作業の最後に、ソースコードの変更内容に合わせて `README.md` と本ファイルを更新する。
