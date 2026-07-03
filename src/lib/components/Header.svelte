<script lang="ts">
  interface Props {
    appName: string;
    tagline: string;
    notifEnabled: boolean;
    onToggleNotif: () => void;
  }

  const { appName, tagline, notifEnabled, onToggleNotif }: Props = $props();
</script>

<header>
  <div class="titles">
    <h1>{appName}</h1>
    <p class="tagline">{tagline}</p>
  </div>
  <button
    type="button"
    class="notif-toggle"
    class:enabled={notifEnabled}
    aria-pressed={notifEnabled}
    aria-label={notifEnabled ? "通知をオフにする" : "通知をオンにする"}
    onclick={onToggleNotif}
  >
    🔔
  </button>
</header>

<style>
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  h1 {
    font-family: "Shippori Mincho", serif;
    margin: 0;
  }

  .tagline {
    color: var(--color-muted, #666);
    margin: 0.25rem 0 0;
  }

  .notif-toggle {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    border: 1px solid var(--color-border, #ccc);
    background: var(--color-surface, #fff);
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.5;
  }

  .notif-toggle.enabled {
    opacity: 1;
    border-color: var(--color-accent, #2a7a4f);
  }
</style>
