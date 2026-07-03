---
name: spec-check
description: Cross-check the current implementation against a specific section of docs/todo-app-spec.md and report deviations. Use when finishing a feature, before marking a phase done, or when the user asks "does this match the spec?" for the ToDo app project.
---

# 仕様書との整合性チェック

`docs/todo-app-spec.md` は要件・データモデル・ロジックの正が記載された唯一のソース。
実装のずれや解釈違いを早期に見つけるため、実装完了時に該当セクションと突き合わせて確認する。

## 手順

1. 対象範囲を明確にする（例:「4.5 今日タブの抽出・並び替えロジック」「8.5 マージ・競合解決」など、ユーザーが指定しない場合は直近の変更に関連するセクションを推定する）
2. `docs/todo-app-spec.md` の該当セクションを読み直し、以下を洗い出す
   - 明記された条件（抽出条件・ソート順・フィールド名・型・デフォルト値など）
   - 境界値・エッジケース（例: 締切未設定は最下位、隔週の基準週判定、通知の再送しない条件など）
3. 実装コード（該当する `.ts`/`.svelte` ファイルとそのテスト）を読み、1つずつ条件を照合する
4. 差分をリストアップする。差分は以下の3種に分類する
   - **仕様違反（要修正）**: 明確に仕様と異なる動作
   - **未実装**: 仕様にあるが実装がまだない項目
   - **仕様の曖昧さ**: 実装判断が分かれ得るがどちらでも要件を満たせる箇所（要ユーザー確認）
5. 「仕様違反」「未実装」は修正候補を提示する。「仕様の曖昧さ」は AskUserQuestion 等でユーザーに確認する。

## 特に見落としやすいポイント（過去の仕様読み込みから）
- 3.1 のフィールドは `updatedAt`/`deletedAt`/`notifiedStart`/`notifiedEndSoon` など同期・通知のための付随フィールドが多く、CRUD 実装時に更新し忘れやすい
- 3.3 の定期タスク完了履歴は `completed` フラグを使わず、日付ごとの別データで管理する（ワンショットと定期タスクで完了管理の実装が異なる点を混同しない）
- 4.5 の並び替えは「優先度→締切の近さ→開始日」の3段階タイブレークがある
- 5.2/5.3 の通知は一度送ったら `notifiedStart`/`notifiedEndSoon` で再送しない
- 8.5 のマージは「削除の伝播」「LWW」「片方のみ存在」の3パターンを Task ごとに区別する
