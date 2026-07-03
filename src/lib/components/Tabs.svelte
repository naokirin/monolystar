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
    gap: 0.25rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--color-border, #ddd);
    overflow-x: auto;
  }

  button {
    flex-shrink: 0;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-muted, #666);
    border-bottom: 2px solid transparent;
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  button.active {
    color: var(--color-accent, #2a7a4f);
    border-bottom-color: var(--color-accent, #2a7a4f);
    font-weight: 500;
  }

  .count {
    font-family: "Roboto Mono", monospace;
    font-size: 0.75rem;
    color: var(--color-muted, #999);
  }
</style>
