<script module lang="ts">
  export type ImportChoice = "remote" | "local" | "merge";
</script>

<script lang="ts">
  import { createSyncFile, InvalidSyncFileError, parseSyncFile } from "../logic/syncFile";
  import { purgeOldCompletions, purgeOldDoneTasks } from "../logic/purge";
  import type { Completions, Prefs, SyncFile, Task } from "../types";
  import ModalDialog from "./ModalDialog.svelte";

  interface Props {
    deviceId: string;
    tasks: Task[];
    completions: Completions;
    prefs: Prefs;
    /** ローカルにタスクが1件もないかどうか（初回インポート判定用） */
    isLocalEmpty: boolean;
    /** 完了記録パージの基準日（YYYY-MM-DD）。対象件数プレビューに使う。 */
    today: string;
    onImport: (choice: ImportChoice, file: SyncFile) => void;
    /** ToDoリストのリセット（全タスクを物理削除する） */
    onReset: () => void;
    /** 古い完了タスク・完了記録の一括削除（完了からの経過日数を指定） */
    onPurgeDone: (thresholdDays: number) => void;
    onError: (message: string) => void;
    onClose: () => void;
  }

  const {
    deviceId,
    tasks,
    completions,
    prefs,
    isLocalEmpty,
    today,
    onImport,
    onReset,
    onPurgeDone,
    onError,
    onClose,
  }: Props = $props();

  /** 未削除（有効）タスクの件数。リセット対象・ボタンの活性判定に使う。 */
  const activeTaskCount = $derived(tasks.filter((t) => t.deletedAt === null).length);
  let confirmReset = $state(false);

  function handleResetConfirm() {
    confirmReset = false;
    onReset();
  }

  // 古い完了タスクの一括削除。完了からの経過日数のしきい値をユーザーが指定する。
  const DEFAULT_PURGE_DAYS = 90;
  let purgeDaysDraft = $state(String(DEFAULT_PURGE_DAYS));
  const purgeDays = $derived(Number(purgeDaysDraft));
  const isPurgeDaysValid = $derived(Number.isInteger(purgeDays) && purgeDays >= 1);
  // 削除対象件数のプレビュー: ワンショット完了タスク + 定期タスクの古い完了記録。
  const purgeTargetCount = $derived(
    isPurgeDaysValid
      ? purgeOldDoneTasks(tasks, purgeDays).removedCount +
          purgeOldCompletions(completions, purgeDays, today).removedCount
      : 0,
  );
  let confirmPurge = $state(false);

  function handlePurgeConfirm() {
    confirmPurge = false;
    onPurgeDone(purgeDays);
  }

  let fileInputEl = $state<HTMLInputElement | undefined>();
  let pendingFile = $state<SyncFile | null>(null);

  function formatCompactDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}${m}${d}`;
  }

  function handleExport() {
    const syncFile = createSyncFile(tasks, completions, prefs, deviceId);
    const json = JSON.stringify(syncFile, null, 2);
    const filename = `monolystar-backup-${formatCompactDate(new Date())}.json`;

    if (navigator.share && navigator.canShare?.({ files: [new File([json], filename)] })) {
      const file = new File([json], filename, { type: "application/json" });
      navigator.share({ files: [file], title: filename }).catch(() => {
        // 共有がキャンセルされた場合は何もしない
      });
      return;
    }

    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFileSelected(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    file
      .text()
      .then((text) => {
        const parsed = parseSyncFile(JSON.parse(text));
        if (isLocalEmpty) {
          onImport("remote", parsed);
        } else {
          pendingFile = parsed;
        }
      })
      .catch((err) => {
        const message =
          err instanceof InvalidSyncFileError
            ? `読み込みに失敗しました: ${err.message}`
            : "読み込みに失敗しました（ファイル形式が不正です）";
        onError(message);
      })
      .finally(() => {
        input.value = "";
      });
  }

  function handleChoice(choice: ImportChoice) {
    if (!pendingFile) return;
    onImport(choice, pendingFile);
    pendingFile = null;
  }

  function handleCancelChoice() {
    pendingFile = null;
  }
</script>

<ModalDialog labelledBy="data-menu-title" onClose={onClose} maxWidth="420px">
  {#snippet children()}
    <h2 id="data-menu-title">データの書き出し・読み込み</h2>
    <p class="description">
      データはあなたの端末と、あなたが選んだファイルにのみ保存されます。
    </p>

    {#if pendingFile}
      <div class="choice">
        <div class="preview">
          <p>読み込むファイルの内容:</p>
          <ul>
            <li>タスク数: {pendingFile.tasks.length}件</li>
            <li>書き出し日時: {new Date(pendingFile.exportedAt).toLocaleString("ja-JP")}</li>
          </ul>
        </div>
        <p>既存のデータがあります。読み込んだデータをどう反映しますか？</p>
        <button type="button" onclick={() => handleChoice("merge")}>マージ（推奨）</button>
        <button type="button" onclick={() => handleChoice("remote")}>読み込んだデータで上書き</button>
        <button type="button" onclick={() => handleChoice("local")}>今のデータのまま（キャンセル）</button>
        <button type="button" class="secondary" onclick={handleCancelChoice}>閉じる</button>
      </div>
    {:else}
      <div class="actions">
        <button type="button" onclick={handleExport}>データを書き出す</button>
        <button type="button" onclick={() => fileInputEl?.click()}>データを読み込む</button>
        <input
          bind:this={fileInputEl}
          type="file"
          accept="application/json"
          class="sr-only"
          onchange={handleFileSelected}
        />
      </div>

      <div class="reset-section">
        <h3>ToDoリストのリセット</h3>
        {#if confirmReset}
          <p class="reset-warning" role="alert">
            有効なタスク{activeTaskCount}件をすべて削除します。この操作は取り消せません。
          </p>
          <div class="actions">
            <button type="button" class="danger" onclick={handleResetConfirm}>すべて削除する</button>
            <button type="button" class="secondary" onclick={() => (confirmReset = false)}>
              キャンセル
            </button>
          </div>
        {:else}
          <p class="description">
            すべてのタスクを削除して最初の状態に戻します。書き出し（バックアップ）をおすすめします。
          </p>
          <button
            type="button"
            class="danger-outline"
            onclick={() => (confirmReset = true)}
            disabled={activeTaskCount === 0}
          >
            ToDoリストをリセット
          </button>
        {/if}
      </div>

      <div class="reset-section">
        <h3>古い完了タスクの一括削除</h3>
        {#if confirmPurge}
          <p class="reset-warning" role="alert">
            完了から{purgeDays}日以上経過したタスク・完了記録{purgeTargetCount}件を削除します。この操作は取り消せません。
          </p>
          <div class="actions">
            <button type="button" class="danger" onclick={handlePurgeConfirm}>削除する</button>
            <button type="button" class="secondary" onclick={() => (confirmPurge = false)}>
              キャンセル
            </button>
          </div>
        {:else}
          <p class="description">
            指定した日数より前に完了したタスクと、定期タスクの古い完了記録をまとめて削除します。
          </p>
          <div class="input-row">
            <label for="purge-days">完了から</label>
            <input
              id="purge-days"
              type="number"
              min="1"
              step="1"
              inputmode="numeric"
              bind:value={purgeDaysDraft}
              aria-invalid={!isPurgeDaysValid}
              aria-describedby={isPurgeDaysValid ? "purge-days-count" : "purge-days-error"}
            />
            <span>日以上前</span>
          </div>
          {#if !isPurgeDaysValid}
            <p id="purge-days-error" class="error" role="alert">
              1以上の整数を入力してください。
            </p>
          {:else}
            <p id="purge-days-count" class="description">削除対象: {purgeTargetCount}件</p>
          {/if}
          <button
            type="button"
            class="danger-outline"
            onclick={() => (confirmPurge = true)}
            disabled={!isPurgeDaysValid || purgeTargetCount === 0}
          >
            古い完了タスクを削除
          </button>
        {/if}
      </div>

      <button type="button" class="secondary close" onclick={onClose}>閉じる</button>
    {/if}
  {/snippet}
</ModalDialog>

<style>
  h2 {
    margin: 0;
    font-family: "Shippori Mincho", serif;
  }

  .description {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-muted, #666);
  }

  .actions,
  .choice {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preview {
    background: var(--color-badge-bg);
    border: 1px solid var(--color-border-soft);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
  }

  .preview p {
    margin: 0 0 0.25rem;
    font-weight: 500;
  }

  .preview ul {
    margin: 0;
    padding-left: 1.2rem;
  }

  button {
    padding: 0.6rem 1rem;
    border-radius: 6px;
    border: none;
    background: var(--color-accent);
    color: var(--color-surface);
    cursor: pointer;
    font-size: 0.9rem;
  }

  button.secondary {
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    color: var(--color-ink);
  }

  button.close {
    align-self: flex-start;
  }

  .reset-section {
    border: 1px solid var(--color-hanko);
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reset-section h3 {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-hanko);
  }

  .reset-warning {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-warning-text);
    font-weight: 500;
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .input-row label {
    font-weight: 500;
  }

  .input-row input[type="number"] {
    width: 5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 6px;
    border: 2px solid var(--color-border);
    font-size: 1rem;
    font-family: "Roboto Mono", monospace;
  }

  .input-row input[aria-invalid="true"] {
    border-color: var(--color-hanko);
  }

  .error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-warning-text);
    font-weight: 500;
  }

  button.danger {
    background: var(--color-hanko);
    color: var(--color-surface);
  }

  button.danger-outline {
    background: var(--color-surface);
    border: 2px solid var(--color-hanko);
    color: var(--color-hanko);
  }

  button.danger-outline:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
