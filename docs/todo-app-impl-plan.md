# 「MONOLYSTAR」ToDoアプリ Phase 1 実装計画

`docs/todo-app-spec.md`（仕様の正のソース）と `docs/todo-app-tech-stack.md`（技術選定）に基づく Phase 1 の実装計画。

## 背景・目的

現在ヘッダーのみの Svelte 雛形（`src/App.svelte`）から **Phase 1 の全機能** を実装する。

Phase 1 のゴール（仕様書 8.7）:

- 必須要件 2.1（クイック追加／詳細フォーム／日時範囲／優先度／今日タブ自動ソート／完了管理／定期タスク）
- 追加要件 2.2（開始・締切通知／カテゴリ）
- 複数デバイス共有 2.3 #11,#12（手動エクスポート／インポート＋マージロジック、`updatedAt`/`deletedAt` 追加）

Phase 2（File System Access API / WebDAV 自動同期）・Phase 3（P2P・暗号化）は本計画の対象外だが、
データモデルとマージロジックは Phase 2 を見据えて `updatedAt`/`deletedAt`/`SyncMeta` を含めて実装する。

**進め方**: 機能単位で段階コミット。各コミット前に `npm run build` / `npm run test` / `npm run check` を通す（CLAUDE.md 規約）。
バグ・データ損失リスクの高い領域は専門 Subagent に委譲する。

## 技術前提（確定済み・変更しない）

Svelte 5 + Vite（SvelteKit不使用）／TypeScript／素のCSS+scoped style／Vitest+Testing Library／Svelte store（追加ライブラリなし）。
`vite.config.ts` は production 時のみ `viteSingleFile()` 有効化済み。フォントは `index.html` で Google Fonts CDN 読込済み。
**新規ライブラリの追加は行わない**（必要が生じたらユーザー確認）。

## ディレクトリ構成（新規）

```
src/
  lib/
    types.ts                 データモデル型（3.1〜3.7）
    stores/
      persist.ts             localStorage連動 store 生成ヘルパー
      tasks.ts               tasks-v1
      completions.ts         completions-v1
      prefs.ts               prefs-v1
      syncMeta.ts            sync-meta-v1（deviceId 生成含む）
    logic/
      dates.ts               今日文字列・日時パース・比較の共通関数
      recurrence.ts          繰り返し判定（3.2）※recurrence-logic agent
      todaySort.ts           今日タブ抽出/並び替え（4.5）※sort-logic agent
      notifications.ts       開始/締切通知判定（5.2〜5.3）
      merge.ts               同期マージ/競合解決（8.5）※sync-merge agent
      syncFile.ts            同期ファイル形式の生成/検証（3.7）
    components/
      Header.svelte          ヘッダー・通知トグル🔔・データメニュー（4.1/8.4）
      QuickAddBar.svelte     クイック追加（4.2）
      Tabs.svelte            タブ切替＋件数（4.4）
      TaskList.svelte        リスト＋空状態（4.4/6）
      TaskCard.svelte        カード表示・完了トグル（4.6/4.7）
      TaskFormModal.svelte   詳細入力フォーム 追加/編集/削除共通（4.3）
      DataMenu.svelte        エクスポート/インポート＋マージ選択UI（8.3.1/8.4/8.5）
      Toast.svelte           トースト（6）
  App.svelte                 全体の状態オーケストレーション
  main.ts                    （既存・変更なし想定）
```

各 `logic/*.ts` に対応する `*.test.ts` を併置する。

## 実装ステップ（＝コミット単位）

### 1. データモデル型 + 永続化 store 基盤

- `types.ts`: `Task`/`Recurrence`(none/daily/weekly/biweekly)/`Completions`/`Prefs`/`SyncMeta`/`SyncFile` を仕様書 3 章どおりに定義。
- `stores/persist.ts`: `writable` をラップし、初期値を `localStorage` から読み、`subscribe` で書き戻す汎用関数。JSON パース失敗時はデフォルトにフォールバック。
- `stores/{tasks,completions,prefs,syncMeta}.ts`: 各キー（`tasks-v1` 他）で生成。`syncMeta` は初回に `crypto.randomUUID()` で `deviceId` 生成。

### 2. 日付ユーティリティ + 繰り返し判定ロジック（Subagent: recurrence-logic）

- `logic/dates.ts`: `todayStr()`（ローカル `YYYY-MM-DD`）、日付比較、`endDate+endTime`/`startDate+startTime` を Date 化するヘルパー。タイムゾーンはローカル基準で統一。
- `logic/recurrence.ts`: `isRecurringDueToday(task, dateStr)` — daily/weekly(曜日)/biweekly(startDate基準週から2週おき)判定＋有効期間(startDate〜endDate)チェック。
- **recurrence-logic Subagent に実装・テストを委譲**（週境界・曜日インデックス・隔週基準週の Vitest 境界値テスト必須）。

### 3. 今日タブ 抽出/並び替えロジック（Subagent: sort-logic）

- `logic/todaySort.ts`: 4.5 の抽出条件（ワンショット: 未完了かつ startDate≤今日≤endDate／定期: 該当日かつ当日完了記録なしかつ有効期間内）と、優先度→締切近さ→開始日 の3段タイブレークソート。`recurrence.ts` を再利用。
- **sort-logic Subagent に実装・テストを委譲**（未設定日・タイ・優先度混在の境界値テスト必須）。

### 4. クイック追加バー + タスクカード + 基本一覧表示

- `QuickAddBar.svelte`: タイトルのみで `should`/日時なし/カテゴリなし/`none` のデフォルトタスク作成（4.2）。Enter 対応。「＋詳細…」でフォームを開くフック。
- `TaskCard.svelte`: 左端カラーストライプ（必須=赤/できれば=黄、CSS変数 `--color-must`/`--color-should`）、タイトル、バッジ（優先度/カテゴリ/日時範囲/繰り返し）、締切24h以内の警告色、詳細メモ、完了トグルの丸ボタン（4.7/4.6）。
- `TaskList.svelte`＋`App.svelte`: まず「すべて」タブ相当の一覧で表示確認。

### 5. 詳細入力フォームモーダル（追加/編集/削除共通）

- `TaskFormModal.svelte`: 4.3 の全項目（タイトル/詳細/優先度/カテゴリ datalist サジェスト/繰り返し＋曜日UI/開始・終了日時）。繰り返し有無でラベル切替。編集時のみ削除ボタン（確認後に論理削除 `deletedAt`＋物理除去はストア方針に合わせる）。
- 保存時に `updatedAt` 更新。カテゴリ候補は既存タスクから収集。
- **fixing-accessibility Skill を適用**（モーダルのフォーカストラップ・ARIA・キーボード・フォームエラー）。

### 6. タブ構成 + 完了操作

- `Tabs.svelte`: 今日/すべて/完了/定期タスク＋各件数（4.4）。
  - 今日: `todaySort.ts` の結果。すべて: 未完了ワンショットを開始日昇順。完了: 完了ワンショットを完了日時降順（タップで未完了へ）。定期タスク: テンプレ一覧（今日分完了ラベル）。
- 完了操作（4.6）: ワンショットは `completed`/`completedAt`、定期は当日 Completions トグル。取り消し線＋フェード。
- **fixing-motion-performance Skill を適用**（フェード/トーストは transform/opacity・`prefers-reduced-motion`）。

### 7. 通知（Notification API）

- `logic/notifications.ts`: 開始通知（5.2: 開始日時経過かつ `notifiedStart=false`）／締切接近（5.3: 締切24h以内かつ `notifiedEndSoon=false`）の判定関数。定期タスクは対象外（5.4）。
- `Header.svelte` の🔔で `Notification.requestPermission()`、許可時のみ `prefs.notif=true` を保存し `setInterval` 60秒でポーリング（5.1）。通知済みフラグを記録。
- 判定関数に Vitest テストを添える。

### 8. トースト + 空状態 + アクセシビリティ/モーション仕上げ

- `Toast.svelte`: 画面下部・短時間・`aria-live`（6章）。
- 各タブの空状態案内文（6章）。
- Skill `fixing-accessibility` / `fixing-motion-performance` を全 UI に通しで再適用。

### 9. 同期マージ/競合解決ロジック（Subagent: sync-merge）

- `logic/merge.ts`: 8.5 のルール — Task は `id` 一致で `deletedAt` 優先→`updatedAt` LWW→片側のみ取込。Completions は `at` 新しい方。Prefs は `updatedAt` 新しい方。競合候補件数の算出。
- `logic/syncFile.ts`: 3.7 の `SyncFile`(schemaVersion:1) の生成/検証。
- **sync-merge Subagent に実装・テストを委譲**（データ損失＝最重要。削除伝播・LWW・completions 競合の Vitest テスト必須）。

### 10. 手動エクスポート/インポート UI（8.3.1）

- `DataMenu.svelte`: 「データを書き出す」＝`SyncFile` を `<a download>` で `monolystar-backup-YYYYMMDD.json` 保存（Web Share API があれば共有も）。「データを読み込む」＝`<input type="file">`→プレビュー→「リモートで上書き/ローカルで上書き/マージ(推奨)」選択（8.5）。初回（ローカル空）は確認なし取込。
- 取込後にストア更新＆再描画、トーストで結果（競合件数）表示。

### 11. 最終検証・ドキュメント更新

- Skill `build-singlefile` で `dist/index.html` が真の単一ファイル（外部参照なし）か検証。
- Skill `spec-check` で各章（特に 4.5 / 3.2 / 8.5 / 5.x）との整合を確認。
- `README.md` / `CLAUDE.md` を実装内容に合わせて更新。

## 再利用する既存資産

- `vite.config.ts`（singlefile 分岐・Vitest 設定）／`src/test-setup.ts`（jest-dom）／`index.html`（フォント CDN・`#app`）はそのまま利用。
- 専門 Subagent: `recurrence-logic`（step2）/`sort-logic`（step3）/`sync-merge`（step9）。
- Skill: `fixing-accessibility`・`fixing-motion-performance`（UI 各 step）／`build-singlefile`・`spec-check`（step11）。

## 検証（エンドツーエンド）

- **ロジック**: `npm run test` で recurrence/todaySort/notifications/merge の境界値テストが緑。
- **型**: `npm run check` が 0 エラー。
- **ビルド**: `npm run build` 成功後、`build-singlefile` Skill で `dist/index.html` の単一ファイル性を確認。
- **手動動作確認**: `npm run dev` で ①クイック追加→今日タブに反映 ②詳細フォームで定期タスク作成→該当曜日に今日タブ表示 ③完了トグル→完了タブ移動 ④通知許可→開始/締切通知発火 ⑤エクスポート→別プロファイルでインポート（マージ）してデータ統合を確認。
- 仕上げに `spec-check` Skill で仕様乖離がないか確認。
