# 「やることだけ」ToDo管理アプリ 技術スタック決定書

`docs/todo-app-spec.md` の要件・仕様を実現するための技術選定結果。

## 1. フロントエンドフレームワーク

**Svelte（素の Svelte + Vite。SvelteKit は使わない）**

- 検証: `vite-plugin-singlefile` により、Vite でビルドした JS/CSS を1つの `index.html` にインライン化できることを確認済み（Gemini によるWeb検索で実例・注意点を確認）。
- 本アプリはタブ切り替えのみで、ページ遷移を伴う SPA ルーティングを使わないため、`vite-plugin-singlefile` 特有の懸念点（`history.pushState` 非対応など）は該当しない。
- SvelteKit は標準で単一ファイル出力（`bundleStrategy: 'inline'`）に対応するが、本アプリの規模ではルーティング等の機能が過剰で構成が複雑になるため不採用。
- Vanilla JS（フレームワークなし）も候補だったが、タブ状態・フォーム状態・リアクティブなソート表示など、状態と DOM の同期が多い本アプリでは Svelte のリアクティビティ（`$:`、store）が保守性の面で有利と判断。

### 落とし穴・注意点
- `public` フォルダの静的アセット（画像等）は自動インライン化されないため、フォントは後述の方法で別途対応する。
- ソースマップがインライン化後は実ソースと対応しなくなるため、開発時は非インライン化ビルド（通常の `vite dev`）でデバッグし、リリース時のみ `vite-plugin-singlefile` を有効にする運用とする。

## 2. 実装言語

**TypeScript**

- 仕様書 3.1〜3.7 で `Task` / `Recurrence` / `SyncMeta` / 同期ファイル形式などの型が明確に定義されているため、型定義をそのままコードに落とし込める。
- 特にフェーズ2以降の同期・マージロジック（8.5）は競合解決の分岐が多く、型チェックによる不整合の早期検出が有効。

## 3. スタイリング

**素の CSS + Svelte の scoped `<style>`**

- 単一 HTML ファイル出力との相性がよく、余計なビルドステップ（Tailwind の PurgeCSS 連携等）を増やさない。
- 見出し=明朝体（Shippori Mincho）／本文=ゴシック体（Zen Kaku Gothic New）／日時=モノスペース（Roboto Mono）という独自デザイン方針があり、ユーティリティクラスより素の CSS でのカスタム調整の方が適している。
- CSS カスタムプロパティ（`--color-must` 等）でカラーストライプ（必須=赤／できれば=黄）や警告色を管理する。

### フォント読み込み
- **Google Fonts の CDN `<link>` 読み込み**を採用（オンライン利用を前提とし、実装のシンプルさを優先）。完全オフライン環境ではフォールバックフォント表示になる点は許容する。

## 4. テスト

**Vitest + Testing Library（`@testing-library/svelte`）**

- 「今日」タブの抽出・並び替えロジック（4.5）、通知判定（5.2〜5.3）、同期マージ・競合解決ロジック（8.5）は条件分岐が多く、仕様通りの動作をユニットテストで担保する。
- E2E は Phase 1 の範囲では導入せず、必要になった時点で検討する。

## 5. ビルド・パッケージ管理

- **Vite** + `@sveltejs/vite-plugin-svelte` + `vite-plugin-singlefile`
- パッケージマネージャは **npm**（追加ツール不要、Node.js 標準同梱）

## 6. 状態管理

- 追加ライブラリは導入せず、**Svelte の組み込み store**（`writable`/`derived`）で完結させる。
  - タスク一覧・完了履歴・通知設定はそれぞれ store として保持し、`localStorage`（`tasks-v1` / `completions-v1` / `prefs-v1` / `sync-meta-v1`）への読み書きは store の購読（`subscribe`）で同期する。

## 7. ブラウザ API 利用方針（追加ライブラリなしで直接利用）

| API | 用途 | 備考 |
|---|---|---|
| `localStorage` | タスク・完了履歴・通知設定・同期メタデータの永続化 | 3.5 |
| `Notification` | 開始通知・締切接近通知 | 5.1〜5.4。60秒間隔のポーリングは `setInterval` |
| `File System Access API`（`showOpenFilePicker`/`showSaveFilePicker`） | Phase 2 同期ファイル方式 | 8.3.2。Safari/iOS 非対応時は Phase 1（手動エクスポート/インポート）にフォールバック |
| `fetch`（WebDAV PROPFIND/GET/PUT） | Phase 2 WebDAV 同期 | 8.3.3。認証情報は `sessionStorage` のみ |
| `Web Share API` | エクスポートファイルの共有（任意） | 8.3.1 |

いずれも開発者サーバを経由しない仕様（1.3・8.6）と直接合致するため、追加の SDK やクラウド連携ライブラリは導入しない。

## 8. 実装フェーズと技術スタックの対応

| フェーズ | 内容 | 追加で必要な技術要素 |
|---|---|---|
| Phase 1 | 必須要件（2.1）・追加要件（2.2）・手動エクスポート/インポート（2.3 #11,#12） | 上記スタックのみで実現可能 |
| Phase 2 | 同期ファイル（File System Access API）または WebDAV | 追加ライブラリ不要（ブラウザ標準 API） |
| Phase 3 | P2P 同期・暗号化オプション | WebRTC（標準 API）、暗号化は Web Crypto API（`AES-GCM`）を想定。必要になった時点で改めて選定 |

## 9. まとめ（技術スタック一覧）

| 項目 | 選定 |
|---|---|
| フレームワーク | Svelte + Vite（SvelteKit不使用） |
| 単一HTML化 | vite-plugin-singlefile |
| 言語 | TypeScript |
| スタイリング | 素のCSS + Svelte scoped style |
| フォント | Google Fonts CDN |
| テスト | Vitest + @testing-library/svelte |
| 状態管理 | Svelte store（組み込み、追加ライブラリなし） |
| パッケージ管理 | npm |
| 永続化 | localStorage（ブラウザ標準） |
| 通知 | Notification API（ブラウザ標準） |
| 同期（Phase2以降） | File System Access API / WebDAV（`fetch`）、いずれもブラウザ標準API |

## 10. デザイン品質を高めるための開発支援Skill

デザイン・アクセシビリティ・アニメーション品質を洗練させるため、以下のSkillを `.claude/skills/` に導入した。

| Skill | 用途 | 由来 |
|---|---|---|
| `fixing-accessibility` | ARIAラベル・キーボード操作・フォーカス管理・フォームエラー等のアクセシビリティ監査/修正 | npm パッケージ [`ui-skills`](https://www.npmjs.com/package/ui-skills)（作者: ibelick）の同梱Skillをそのまま採用。フレームワーク非依存でSvelteでも適用可能 |
| `fixing-motion-performance` | レイアウトスラッシング回避・compositorプロパティ（transform/opacity）優先・`prefers-reduced-motion`配慮などアニメーション性能の監査/修正 | 同上。完了時のフェード表示（4.6）やトースト通知（6章）のアニメーション実装時に適用 |

`baseline-ui`（同パッケージ収録）は Tailwind CSS / React / Radix 前提のルールが中心で、本プロジェクトの「素のCSS + Svelte scoped style」方針と合わないため不採用。`fixing-metadata`はSEO/OGタグ向けで単一HTMLローカルアプリには不要のため不採用。

なお `frontend-design`（Anthropic公式、美的方向性のガイダンス）は環境に既にexample skillとして用意されており、追加導入は不要。
