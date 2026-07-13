<script module lang="ts">
  export interface ToastMessage {
    id: number;
    text: string;
    /** 表示中に押せる任意のアクション（例: 削除のUndo）。 */
    action?: { label: string; onAction: () => void };
    /** 自動で消えるまでの時間（ミリ秒）。未指定時は呼び出し側の既定値に従う。 */
    durationMs?: number;
  }
</script>

<script lang="ts">
  interface Props {
    toasts: ToastMessage[];
    /** アクションボタン押下・タイムアウト以外でトーストを消す場合に呼ぶ（アクション実行時の即時クローズ用）。 */
    onDismiss?: (id: number) => void;
  }

  const { toasts, onDismiss }: Props = $props();

  function handleAction(toast: ToastMessage) {
    toast.action?.onAction();
    onDismiss?.(toast.id);
  }
</script>

<div class="toast-container" aria-live="polite" role="status">
  {#each toasts as toast (toast.id)}
    <div class="toast" style:animation-duration="{(toast.durationMs ?? 2500) / 1000}s">
      <span>{toast.text}</span>
      {#if toast.action}
        <button type="button" class="toast-action" onclick={() => handleAction(toast)}>
          {toast.action.label}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    left: 50%;
    bottom: 1.5rem;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 200;
    pointer-events: none;
  }

  .toast {
    background: var(--color-toast-bg, #333);
    color: var(--color-toast-text, #fff);
    padding: 0.6rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    white-space: nowrap;
    opacity: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    /* button要素をクリック可能にするため、親コンテナのpointer-events:noneを打ち消す。 */
    pointer-events: auto;
    animation-name: fade-in-out;
    animation-timing-function: ease;
    animation-fill-mode: forwards;
  }

  .toast-action {
    flex-shrink: 0;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--color-toast-text, #fff);
    border-radius: 4px;
    background: transparent;
    color: var(--color-toast-text, #fff);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .toast-action:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  @keyframes fade-in-out {
    0% {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    10% {
      opacity: 1;
      transform: translateY(0);
    }
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
