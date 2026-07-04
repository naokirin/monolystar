<script lang="ts">
  interface Props {
    appName: string;
    tagline: string;
    notifEnabled: boolean;
    onToggleNotif: () => void;
    onOpenDataMenu: () => void;
  }

  const { appName, tagline, notifEnabled, onToggleNotif, onOpenDataMenu }: Props = $props();
</script>

<header>
  <div class="titles">
    <h1>{appName}</h1>
    <p class="tagline">{tagline}</p>
  </div>
  <div class="actions">
    <button type="button" class="icon-button" aria-label="データの書き出し・読み込み" onclick={onOpenDataMenu}>
      🗂️
    </button>
    <button
      type="button"
      class="icon-button notif-toggle"
      class:enabled={notifEnabled}
      aria-pressed={notifEnabled}
      aria-label={notifEnabled ? "通知をオフにする" : "通知をオンにする"}
      onclick={onToggleNotif}
    >
      🔔
    </button>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 0.9rem;
    margin-bottom: 1.25rem;
    border-bottom: 2px solid var(--color-border);
  }

  h1 {
    font-family: "Shippori Mincho", serif;
    letter-spacing: 0.08em;
    margin: 0;
  }

  .tagline {
    color: var(--color-muted);
    margin: 0.3rem 0 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .icon-button {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.7;
    transition: transform 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
  }

  .notif-toggle.enabled {
    opacity: 1;
    border: 2px solid var(--color-hanko-ring);
    color: var(--color-hanko);
    transform: rotate(-6deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-button {
      transition: none;
    }
  }
</style>
