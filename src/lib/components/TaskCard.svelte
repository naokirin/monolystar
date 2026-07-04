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
      stamping = true;
      setTimeout(() => onToggle(task.id), 240);
      setTimeout(() => {
        stamping = false;
      }, 700);
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
    <span class="stamp" aria-hidden="true">済</span>
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
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem 0.9rem;
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

  .card.completed {
    opacity: 0.65;
  }

  .card.completed .title {
    text-decoration: line-through;
  }

  /* 目印（インデックスタブ／しおり）。カード左端から覗く付箋のタブ。
     未使用時はごく控えめに、ホバー/フォーカスで気づける程度に。 */
  .marker-tab {
    position: absolute;
    left: -5px;
    top: 50%;
    width: 15px;
    height: 44px;
    padding: 0;
    transform: translateY(-50%);
    transform-origin: left center;
    border: none;
    border-radius: 4px 0 0 4px;
    background: var(--color-border-soft);
    opacity: 0.32;
    cursor: pointer;
    transition: opacity 0.15s ease, background-color 0.15s ease;
  }

  .card:hover .marker-tab,
  .marker-tab:focus-visible {
    opacity: 0.6;
  }

  .card.marked .marker-tab {
    background: var(--color-accent);
    opacity: 1;
    box-shadow: -1px 1px 2px rgba(0, 0, 0, 0.22);
  }

  .card.marked .marker-tab.sticking {
    animation: tab-stick 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  /* 完了時の判子スタンプ（朱印「済」）。装飾のみ。 */
  .stamp {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border: 2px solid var(--color-hanko);
    border-radius: 50%;
    color: var(--color-hanko);
    font-family: "Shippori Mincho", serif;
    font-size: 1.35rem;
    font-weight: 700;
    pointer-events: none;
    transform: translate(-50%, -50%);
    animation: stamp-press 0.6s ease-out forwards;
  }

  @keyframes stamp-press {
    0% {
      transform: translate(-50%, -50%) scale(1.7) rotate(-16deg);
      opacity: 0;
    }
    30% {
      transform: translate(-50%, -50%) scale(0.9) rotate(-8deg);
      opacity: 1;
    }
    45% {
      transform: translate(-50%, -50%) scale(1) rotate(-8deg);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1) rotate(-8deg);
      opacity: 0;
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
    .stamp {
      animation: none;
    }
  }
</style>
