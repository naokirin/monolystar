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
    border-bottom: 2px solid var(--color-divider-on-bg);
  }

  h1 {
    font-family: "Shippori Mincho", serif;
    letter-spacing: 0.08em;
    color: var(--color-on-bg);
    margin: 0;
  }

  .tagline {
    color: var(--color-on-bg-muted);
    margin: 0.3rem 0 0;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .icon-button {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: var(--color-surface);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
    font-size: 1.15rem;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .icon-button:hover {
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.22);
    transform: translateY(-1px);
  }

  .notif-toggle.enabled {
    border-color: var(--color-hanko-ring);
    color: var(--color-hanko);
    transform: rotate(-6deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-button {
      transition: none;
    }
  }
</style>
