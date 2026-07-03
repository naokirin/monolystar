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
    gap: 0.5rem;
  }

  input {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-border, #ccc);
    border-radius: 6px;
    font-size: 1rem;
  }

  button {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    background: var(--color-accent, #2a7a4f);
    color: #fff;
    font-weight: 500;
    cursor: pointer;
  }

  .detail-link {
    align-self: flex-start;
    background: none;
    color: var(--color-accent, #2a7a4f);
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
