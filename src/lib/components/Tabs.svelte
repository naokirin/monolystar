<script module lang="ts">
  export interface TabDef {
    id: string;
    label: string;
    count: number;
  }
</script>

<script lang="ts">
  interface Props {
    tabs: TabDef[];
    activeTab: string;
    onSelect: (tabId: string) => void;
  }

  const { tabs, activeTab, onSelect }: Props = $props();
</script>

<div class="tabs" role="tablist">
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      role="tab"
      id="tab-{tab.id}"
      aria-selected={tab.id === activeTab}
      aria-controls="tabpanel-{tab.id}"
      class:active={tab.id === activeTab}
      onclick={() => onSelect(tab.id)}
    >
      {tab.label}
      <span class="count">{tab.count}</span>
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.2rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid var(--color-border);
    overflow-x: auto;
  }

  button {
    flex-shrink: 0;
    padding: 0.5rem 0.9rem 0.45rem;
    border: 2px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    background: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    transform: translateY(2px);
    transition: transform 0.15s ease, background-color 0.15s ease;
  }

  button.active {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-accent-strong);
    font-weight: 500;
    transform: translateY(0);
  }

  .count {
    font-family: "Roboto Mono", monospace;
    font-size: 0.75rem;
    color: var(--color-muted);
  }

  button.active .count {
    color: var(--color-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
