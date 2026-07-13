<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** aria-labelledby に渡すID（見出し要素のid） */
    labelledBy: string;
    /** Escapeキー・backdropクリック時に呼ぶクローズ処理 */
    onClose: () => void;
    /** パネルの最大幅（例: "480px"） */
    maxWidth: string;
    /** パネル内部（直下の子要素間）のgap。未指定時は0.75rem。 */
    gap?: string;
    /** マウント時にフォーカスする要素を返す。未指定・null/undefined返却時は最初のfocusable要素。 */
    getInitialFocusEl?: () => HTMLElement | null | undefined;
    children: Snippet;
  }

  const {
    labelledBy,
    onClose,
    maxWidth,
    gap = "0.75rem",
    getInitialFocusEl,
    children,
  }: Props = $props();

  let panelEl: HTMLDivElement | undefined = $state();

  // マウント時に初期フォーカス対象へフォーカスし、閉じる際は元のフォーカスへ復帰する。
  $effect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const target = getInitialFocusEl?.() ?? focusableElements()[0];
    target?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  });

  // モーダル表示中は背景のスクロールをロックする。
  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  function focusableElements(): HTMLElement[] {
    if (!panelEl) return [];
    return Array.from(
      panelEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const elements = focusableElements();
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop">
  <button
    type="button"
    class="backdrop-close"
    aria-hidden="true"
    tabindex="-1"
    onclick={onClose}
  ></button>
  <div
    class="panel"
    bind:this={panelEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledBy}
    style:max-width={maxWidth}
    style:gap
  >
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
    z-index: 100;
  }

  /*
   * ビューポート全体に固定する。`.backdrop`（スクロールコンテナ）内で
   * position:absolute にすると、サイズがパディングボックス（ビューポート高さ）に
   * なりスクロール内容と一緒に上へ流れてしまい、ダイアログが画面より高いとき
   * 下部に背景・クリック領域が表示されない。fixed でスクロールに追従させず
   * 常に画面全体を覆う。
   */
  .backdrop-close {
    position: fixed;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
    z-index: 0;
  }

  .panel {
    position: relative;
    z-index: 1;
    background: var(--color-surface, #fff);
    border-radius: 10px;
    padding: 1.5rem;
    width: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
