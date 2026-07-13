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

  let tabEls = $state<HTMLButtonElement[]>([]);

  /**
   * ARIA APG のタブパターンに従い、左右矢印キー（および Home/End）でタブを移動する。
   * roving tabindex（アクティブタブのみ tabindex=0）のため、移動時は選択と
   * フォーカスを同時に切り替える（自動アクティブ化方式）。端では反対側へループする。
   */
  function handleKeydown(event: KeyboardEvent, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onSelect(tabs[next].id);
    tabEls[next]?.focus();
  }
</script>

<div class="tabs" role="tablist">
  {#each tabs as tab, index (tab.id)}
    <button
      type="button"
      role="tab"
      id="tab-{tab.id}"
      aria-selected={tab.id === activeTab}
      aria-controls="tabpanel-{tab.id}"
      tabindex={tab.id === activeTab ? 0 : -1}
      class:active={tab.id === activeTab}
      bind:this={tabEls[index]}
      onclick={() => onSelect(tab.id)}
      onkeydown={(event) => handleKeydown(event, index)}
    >
      {tab.label}
      <span class="count">{tab.count}</span>
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 0.35rem;
    /* overflow-x: auto を指定すると仕様上 overflow-y も auto 扱いになり、
       アクティブタブの浮き上がり（translateY）や影が上下でクリップされるため、
       クリップされても問題ないだけの余白を確保しておく。 */
    padding: 0.4rem 0.15rem 0.2rem;
    margin: -0.4rem -0.15rem 0.6rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  button {
    flex-shrink: 0;
    padding: 0.45rem 0.85rem;
    border: 2px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface-alt);
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--color-muted);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  }

  button.active {
    background: var(--color-surface);
    color: var(--color-accent-strong);
    font-weight: 700;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
    transform: translateY(-2px);
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
