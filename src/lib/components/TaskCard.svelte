<script lang="ts">
  import { prefersReducedMotion } from "../logic/motion";
  import type { Task } from "../types";

  interface Props {
    task: Task;
    completed: boolean;
    /** 完了時に表示するラベル（例: 定期タスクタブの「今日完了」）。省略時は表示しない。 */
    completedLabel?: string;
    onToggle: (taskId: string) => void;
    onToggleMarker: (taskId: string) => void;
    onOpen: (task: Task) => void;
  }

  const { task, completed, completedLabel, onToggle, onToggleMarker, onOpen }: Props = $props();

  // 旧データには marker が無い場合があるため truthy 判定で吸収する。
  const marked = $derived(task.marker === true);

  // 完了時の判子スタンプ・目印の貼付は「ユーザー操作でオンにした瞬間」だけ再生する
  // （初期表示で既存の完了/目印が一斉にアニメするのを防ぐ）。
  let stamping = $state(false);
  let markerSticking = $state(false);

  const recurrenceLabel: Record<Task["recurrence"]["type"], string> = {
    none: "",
    daily: "毎日",
    weekly: "毎週",
    biweekly: "隔週",
  };

  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  function formatRecurrence(task: Task): string {
    if (task.recurrence.type === "none") return "";
    if (task.recurrence.type === "daily") return "毎日";
    const days = (task.recurrence.weekdays ?? []).map((d) => weekdayLabels[d]).join("・");
    return `${recurrenceLabel[task.recurrence.type]}${days}`;
  }

  function formatDateRange(task: Task): string {
    const start = task.startDate
      ? `${task.startDate}${task.startTime ? " " + task.startTime : ""}`
      : "";
    const end = task.endDate
      ? `${task.endDate}${task.endTime ? " " + task.endTime : ""}`
      : "";
    if (!start && !end) return "";
    if (start && end) return `${start} 〜 ${end}`;
    return start || `〜 ${end}`;
  }

  function isDeadlineSoon(task: Task): boolean {
    if (!task.endDate) return false;
    const [y, m, d] = task.endDate.split("-").map(Number);
    const [hh, mm] = (task.endTime ?? "23:59").split(":").map(Number);
    const deadline = new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
    const now = Date.now();
    return deadline - now <= 24 * 60 * 60 * 1000 && deadline - now >= 0;
  }

  const dateRange = $derived(formatDateRange(task));
  const recurrenceText = $derived(formatRecurrence(task));
  const deadlineSoon = $derived(isDeadlineSoon(task));

  function handleCardClick() {
    onOpen(task);
  }

  function handleCardKeydown(event: KeyboardEvent) {
    // カード内のボタン（完了トグル・目印タブ）でのキー操作は、それぞれの
    // 操作のみを行い編集フォームは開かない（keydown のバブリングを無視する）。
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(task);
    }
  }

  function handleToggleClick(event: MouseEvent) {
    event.stopPropagation();
    // 未完了→完了に切り替わるときだけ判子スタンプを再生する。
    // 完了処理（onToggle）はワンショットタスクをリストから外す＝カードを退場させる。
    // スタンプ要素を先に描画してから次tickで完了させることで、退場するカードに
    // スタンプが乗った状態を保証する（同tickで状態変更＋除外すると描画されないため）。
    if (!completed && !prefersReducedMotion()) {
      if (stamping) return; // 演出中の二重発火を防ぐ
      stamping = true;
      // 演出の流れ: チェック描画完了(~0.4s) → 一拍おいて(~0.3s) → 退場開始(0.7s)。
      // onToggle でワンショットはリストから外れてカードが退場する。
      setTimeout(() => onToggle(task.id), 700);
      setTimeout(() => {
        stamping = false;
      }, 950);
      return;
    }
    onToggle(task.id);
  }

  function handleMarkerClick(event: MouseEvent) {
    event.stopPropagation();
    // 目印をオンにする瞬間だけ「タブを貼る」演出を再生する。
    if (!marked && !prefersReducedMotion()) {
      markerSticking = true;
      setTimeout(() => {
        markerSticking = false;
      }, 400);
    }
    onToggleMarker(task.id);
  }
</script>

<div
  class="card"
  class:completed
  class:completing={stamping}
  class:marked
  class:priority-must={task.priority === "must"}
  class:priority-should={task.priority === "should"}
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={handleCardKeydown}
>
  <button
    type="button"
    class="marker-tab"
    class:sticking={markerSticking}
    aria-pressed={marked}
    aria-label={marked ? "目印を外す" : "目印を付ける"}
    onclick={handleMarkerClick}
  ></button>

  {#if stamping}
    <span class="complete-burst" aria-hidden="true">
      <svg viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
        <circle class="burst-ring" cx="18" cy="18" r="16" />
        <path class="burst-check" d="M10.5 18.5 L15.5 23.5 L25.5 12.5" />
      </svg>
    </span>
  {/if}

  <button
    type="button"
    class="toggle"
    aria-pressed={completed}
    aria-label={completed ? "未完了に戻す" : "完了にする"}
    onclick={handleToggleClick}
  >
    {#if completed}✓{/if}
  </button>

  <div class="body">
    <p class="title">{task.title}</p>
    <div class="badges">
      <span class="badge badge-priority">{task.priority === "must" ? "必須" : "できれば"}</span>
      {#if task.category}
        <span class="badge">{task.category}</span>
      {/if}
      {#if dateRange}
        <span class="badge badge-datetime" class:badge-warning={deadlineSoon}>{dateRange}</span>
      {/if}
      {#if recurrenceText}
        <span class="badge">{recurrenceText}</span>
      {/if}
      {#if completed && completedLabel}
        <span class="badge badge-done">{completedLabel}</span>
      {/if}
    </div>
    {#if task.detail}
      <p class="detail">{task.detail}</p>
    {/if}
  </div>
</div>

<style>
  .card {
    position: relative;
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    /* 左は目印タブと完了ボタンが近づきすぎないよう広めに確保する。 */
    padding: 0.75rem 0.9rem 0.75rem 1.6rem;
    border-radius: 3px;
    background: var(--color-surface);
    border: 1px solid var(--color-border-soft);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
    cursor: pointer;
    transition: opacity 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  .card:hover {
    box-shadow: 0 4px 9px rgba(0, 0, 0, 0.2);
    transform: translateY(-1px);
  }

  /* 優先度を示す付箋の折り返し（必須＝朱色／できれば＝からし色）。右上の角を三角に折る。 */
  .card::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 22px 22px 0;
    border-color: transparent transparent transparent transparent;
    filter: drop-shadow(-1px 1px 1px rgba(0, 0, 0, 0.18));
  }

  .card.priority-must::after {
    border-color: transparent var(--color-hanko) transparent transparent;
  }

  .card.priority-should::after {
    border-color: transparent var(--color-tag) transparent transparent;
  }

  /* 完了済み、および完了演出中（ボタン押下直後）は同様に彩度を落とす。
     `.card` の opacity トランジションで滑らかに暗くなる。 */
  .card.completed,
  .card.completing {
    opacity: 0.65;
  }

  .card.completed .title,
  .card.completing .title {
    text-decoration: line-through;
  }

  /* 目印（インデックスタブ／しおり）。カード左端から覗く付箋のタブ。
     未使用時も「枠線のある空タブ」として操作可能なことがわかる程度に見せ、
     設定時は緑インクで塗りつぶす（空=枠線／オン=塗り のトグル表現）。 */
  .marker-tab {
    position: absolute;
    left: -7px;
    top: 50%;
    width: 20px;
    height: 58px;
    padding: 0;
    transform: translateY(-50%);
    transform-origin: left center;
    border: 1.5px solid var(--color-border-soft);
    border-radius: 5px 0 0 5px;
    background: var(--color-surface-alt);
    opacity: 0.75;
    cursor: pointer;
    box-shadow: -1px 1px 1px rgba(0, 0, 0, 0.08);
    /* オン時の三角の折り返しで「付箋」らしさを出す装飾（内側右上）。 */
    background-image: linear-gradient(
      135deg,
      transparent calc(100% - 7px),
      rgba(0, 0, 0, 0.14) calc(100% - 7px)
    );
    transition:
      opacity 0.15s ease,
      background-color 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .card:hover .marker-tab,
  .marker-tab:focus-visible {
    opacity: 1;
    background-color: var(--color-badge-bg);
    border-color: var(--color-tag-ring);
  }

  .card.marked .marker-tab {
    background-color: var(--color-accent);
    border-color: var(--color-accent-strong);
    opacity: 1;
    box-shadow: -1px 1px 2px rgba(0, 0, 0, 0.22);
  }

  .card.marked .marker-tab.sticking {
    animation: tab-stick 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* 完了時のチェックマーク演出。緑インクの円の中でチェックが描かれる。 */
  .complete-burst {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    width: 52px;
    height: 52px;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: burst-pop 0.9s ease-out forwards;
  }

  .complete-burst svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .burst-ring {
    fill: var(--color-accent-bg);
    stroke: var(--color-accent);
    stroke-width: 2;
  }

  .burst-check {
    fill: none;
    stroke: var(--color-accent);
    stroke-width: 3.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 26;
    stroke-dashoffset: 26;
    animation: burst-draw 0.32s 0.08s ease-out forwards;
  }

  @keyframes burst-pop {
    /* 0〜0.18s: ポップイン。〜0.4s でチェック描画が完了する。 */
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    20% {
      transform: translate(-50%, -50%) scale(1.08);
      opacity: 1;
    }
    36% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    /* 〜0.72s まで静止して「一拍」おく。 */
    80% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
    /* その後フェードアウト（カードの退場と重なって消える）。 */
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }

  @keyframes burst-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes tab-stick {
    0% {
      transform: translateY(-50%) translateX(-8px) scaleX(0.5);
    }
    60% {
      transform: translateY(-50%) translateX(2px) scaleX(1.08);
    }
    100% {
      transform: translateY(-50%) translateX(0) scaleX(1);
    }
  }

  .toggle {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: 2px solid var(--color-muted);
    background: var(--color-surface-alt);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-accent);
    font-weight: bold;
  }

  .body {
    flex: 1;
    min-width: 0;
  }

  .title {
    margin: 0 0 0.25rem;
    font-weight: 500;
    word-break: break-word;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .badge {
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: var(--color-badge-bg);
    color: var(--color-badge-text);
  }

  .badge-datetime {
    font-family: "Roboto Mono", monospace;
  }

  .badge-warning {
    background: var(--color-warning-bg);
    color: var(--color-warning-text);
  }

  .badge-done {
    background: var(--color-accent-bg);
    color: var(--color-accent);
  }

  .detail {
    margin: 0.4rem 0 0;
    font-size: 0.875rem;
    color: var(--color-muted);
    white-space: pre-wrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .marker-tab {
      transition: none;
    }

    .card.marked .marker-tab.sticking,
    .complete-burst,
    .burst-check {
      animation: none;
    }
  }
</style>
