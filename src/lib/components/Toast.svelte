<script module lang="ts">
  export interface ToastMessage {
    id: number;
    text: string;
  }
</script>

<script lang="ts">
  interface Props {
    toasts: ToastMessage[];
  }

  const { toasts }: Props = $props();
</script>

<div class="toast-container" aria-live="polite" role="status">
  {#each toasts as toast (toast.id)}
    <div class="toast">{toast.text}</div>
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
    animation: fade-in-out 2.5s ease forwards;
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
