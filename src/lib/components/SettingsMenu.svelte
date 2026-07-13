<script lang="ts">
  import { untrack } from "svelte";
  import { DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS } from "../stores/prefs";

  interface Props {
    farDeadlineThresholdDays: number;
    onSave: (farDeadlineThresholdDays: number) => void;
    onClose: () => void;
  }

  const { farDeadlineThresholdDays, onSave, onClose }: Props = $props();

  let draft = $state(
    untrack(() => String(farDeadlineThresholdDays ?? DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS)),
  );

  const parsed = $derived(Number(draft));
  const isValid = $derived(Number.isInteger(parsed) && parsed >= 1);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!isValid) return;
    onSave(parsed);
  }

  let panelEl = $state<HTMLDivElement | undefined>();

  $effect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusableElements()[0]?.focus();
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
  <div class="panel" bind:this={panelEl} role="dialog" aria-modal="true" aria-labelledby="settings-menu-title">
    <h2 id="settings-menu-title">設定</h2>

    <form onsubmit={handleSubmit}>
      <div class="field">
        <label for="far-deadline-threshold">
          「今日」タブで締切を後回し表示にする日数
        </label>
        <p class="description">
          締切までの残り日数がこの値以上のタスクは、締切未設定のタスクより下に並びます。
        </p>
        <div class="input-row">
          <input
            id="far-deadline-threshold"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            bind:value={draft}
            aria-invalid={!isValid}
            aria-describedby={isValid ? undefined : "far-deadline-threshold-error"}
          />
          <span>日以上先</span>
        </div>
        {#if !isValid}
          <p id="far-deadline-threshold-error" class="error" role="alert">
            1以上の整数を入力してください。
          </p>
        {/if}
      </div>

      <div class="actions">
        <button type="submit" disabled={!isValid}>保存</button>
        <button type="button" class="secondary" onclick={onClose}>閉じる</button>
      </div>
    </form>
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
    position: fixed;
    inset: 0;
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

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-weight: 500;
  }

  .description {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-muted, #666);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  input[type="number"] {
    width: 5rem;
    padding: 0.5rem 0.6rem;
    border-radius: 6px;
    border: 2px solid var(--color-border);
    font-size: 1rem;
    font-family: "Roboto Mono", monospace;
  }

  input[aria-invalid="true"] {
    border-color: var(--color-hanko);
  }

  .error {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-warning-text);
    font-weight: 500;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  button.secondary {
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    color: var(--color-ink);
  }
</style>
