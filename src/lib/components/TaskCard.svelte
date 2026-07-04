<script lang="ts">
  import type { Task } from "../types";

  interface Props {
    task: Task;
    completed: boolean;
    /** 完了時に表示するラベル（例: 定期タスクタブの「今日完了」）。省略時は表示しない。 */
    completedLabel?: string;
    onToggle: (taskId: string) => void;
    onOpen: (task: Task) => void;
  }

  const { task, completed, completedLabel, onToggle, onOpen }: Props = $props();

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
    const weekday =
      task.recurrence.weekday !== undefined
        ? weekdayLabels[task.recurrence.weekday]
        : "";
    return `${recurrenceLabel[task.recurrence.type]}${weekday}`;
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
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(task);
    }
  }

  function handleToggleClick(event: MouseEvent) {
    event.stopPropagation();
    onToggle(task.id);
  }
</script>

<div
  class="card"
  class:completed
  class:priority-must={task.priority === "must"}
  class:priority-should={task.priority === "should"}
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={handleCardKeydown}
>
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
    padding: 1.1rem 0.9rem 0.75rem;
    border-radius: 3px;
    background: var(--color-surface);
    border-top: 2px dashed var(--color-border);
    box-shadow: 0 1px 0 var(--color-border);
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  /* ミシン目のパンチ穴（台紙の色を差し込んで穴に見せる） */
  .card::before {
    content: "";
    position: absolute;
    top: -6px;
    left: 16%;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--color-bg);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.28);
  }

  .card.priority-should::before {
    left: auto;
    right: 16%;
  }

  /* 「必須」＝朱色の判子スタンプ */
  .card.priority-must::after {
    content: "必";
    position: absolute;
    top: -12px;
    right: 0.9rem;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 50%;
    border: 2px solid var(--color-hanko-ring);
    color: var(--color-hanko);
    background: radial-gradient(circle at 32% 28%, rgba(178, 58, 46, 0.16), transparent 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "Shippori Mincho", serif;
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1;
    transform: rotate(-8deg);
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  /* 「できれば」＝控えめな付箋タグ（三角の折り返し） */
  .card.priority-should::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0 20px 20px 0;
    border-color: transparent var(--color-tag) transparent transparent;
    pointer-events: none;
  }

  .card.completed {
    opacity: 0.55;
  }

  .card.completed .title {
    text-decoration: line-through;
  }

  .toggle {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: 2px solid var(--color-muted);
    background: transparent;
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
    .card {
      transition: none;
    }
  }
</style>
