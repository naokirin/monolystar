<script module lang="ts">
  export type ImportChoice = "remote" | "local" | "merge";
</script>

<script lang="ts">
  import { createSyncFile, InvalidSyncFileError, parseSyncFile } from "../logic/syncFile";
  import type { Completions, Prefs, SyncFile, Task } from "../types";

  interface Props {
    deviceId: string;
    tasks: Task[];
    completions: Completions;
    prefs: Prefs;
    /** ローカルにタスクが1件もないかどうか（初回インポート判定用） */
    isLocalEmpty: boolean;
    onImport: (choice: ImportChoice, file: SyncFile) => void;
    onError: (message: string) => void;
    onClose: () => void;
  }

  const { deviceId, tasks, completions, prefs, isLocalEmpty, onImport, onError, onClose }: Props =
    $props();

  let fileInputEl = $state<HTMLInputElement | undefined>();
  let pendingFile = $state<SyncFile | null>(null);
  let panelEl = $state<HTMLDivElement | undefined>();
  let firstButtonEl = $state<HTMLButtonElement | undefined>();

  $effect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstButtonEl?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  });

  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  function focusableElements(): HTMLElement[] {
    if (!panelEl) return [];
    return Array.from(
      panelEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const elements = focusableElements();
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function formatCompactDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}${m}${d}`;
  }

  function handleExport() {
    const syncFile = createSyncFile(tasks, completions, prefs, deviceId);
    const json = JSON.stringify(syncFile, null, 2);
    const filename = `yaru-koto-dake-backup-${formatCompactDate(new Date())}.json`;

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

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop">
  <button
    type="button"
    class="backdrop-close"
    aria-hidden="true"
    tabindex="-1"
    onclick={onClose}
  ></button>
  <div class="panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-labelledby="data-menu-title">
    <h2 id="data-menu-title">データの書き出し・読み込み</h2>
    <p class="description">
      データはあなたの端末と、あなたが選んだファイルにのみ保存されます。
    </p>

    {#if pendingFile}
      <div class="choice">
        <p>既存のデータがあります。読み込んだデータをどう反映しますか？</p>
        <button type="button" bind:this={firstButtonEl} onclick={() => handleChoice("merge")}>マージ（推奨）</button>
        <button type="button" onclick={() => handleChoice("remote")}>読み込んだデータで上書き</button>
        <button type="button" onclick={() => handleChoice("local")}>今のデータのまま（キャンセル）</button>
        <button type="button" class="secondary" onclick={handleCancelChoice}>閉じる</button>
      </div>
    {:else}
      <div class="actions">
        <button type="button" bind:this={firstButtonEl} onclick={handleExport}>データを書き出す</button>
        <button type="button" onclick={() => fileInputEl?.click()}>データを読み込む</button>
        <input
          bind:this={fileInputEl}
          type="file"
          accept="application/json"
          class="sr-only"
          onchange={handleFileSelected}
        />
      </div>
      <button type="button" class="secondary close" onclick={onClose}>閉じる</button>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
    z-index: 100;
  }

  .backdrop-close {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
    z-index: 0;
  }

  .panel {
    position: relative;
    z-index: 1;
    background: var(--color-surface, #fff);
    border-radius: 10px;
    padding: 1.5rem;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

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

  button {
    padding: 0.6rem 1rem;
    border-radius: 6px;
    border: none;
    background: var(--color-accent, #2a7a4f);
    color: #fff;
    cursor: pointer;
    font-size: 0.9rem;
  }

  button.secondary {
    background: var(--color-badge-bg, #f0f0f0);
    color: var(--color-badge-text, #444);
  }

  button.close {
    align-self: flex-start;
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
