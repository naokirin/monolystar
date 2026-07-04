<script lang="ts">
  interface Props {
    onAdd: (title: string) => void;
    onOpenDetail: (title: string) => void;
  }

  const { onAdd, onOpenDetail }: Props = $props();

  let title = $state("");

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    title = "";
  }

  function handleKeydown(event: KeyboardEvent) {
    // IME変換確定のEnterでは送信しない（isComposing中、またはブラウザ互換のためkeyCode 229も判定）
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  }

  function handleOpenDetail() {
    onOpenDetail(title.trim());
  }
</script>

<div class="quick-add">
  <div class="row">
    <label class="sr-only" for="quick-add-input">タスクのタイトル</label>
    <input
      id="quick-add-input"
      type="text"
      placeholder="やることを入力..."
      bind:value={title}
      onkeydown={handleKeydown}
    />
    <button type="button" onclick={submit}>追加</button>
  </div>
  <button type="button" class="detail-link" onclick={handleOpenDetail}>
    ＋ 詳細・日時・優先度を設定して追加
  </button>
</div>

<style>
  .quick-add {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  .row {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }

  input {
    flex: 1;
    padding: 0.55rem 0.75rem;
    border: 2px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    font-size: 1rem;
    color: var(--color-ink);
  }

  input::placeholder {
    color: var(--color-muted);
  }

  button {
    padding: 0.55rem 1.1rem;
    border: none;
    border-radius: 4px;
    background: var(--color-accent);
    color: var(--color-surface);
    font-weight: 500;
    cursor: pointer;
  }

  button:hover {
    background: var(--color-accent-strong);
  }

  .detail-link {
    align-self: flex-start;
    background: none;
    color: var(--color-accent-strong);
    padding: 0.2rem 0;
    font-size: 0.875rem;
    text-decoration: underline;
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
