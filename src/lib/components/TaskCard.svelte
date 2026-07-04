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
    margin-top: 0.6rem;
    padding: 0.85rem 0.9rem 0.75rem;
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

  /* 優先度を示すピン（必須＝朱色／できれば＝からし色）。ボードに刺さっているように見せる。 */
  .card::before {
    content: "";
    position: absolute;
    top: -0.55rem;
    left: 1.1rem;
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.65), transparent 60%),
      var(--color-hanko);
    border: 1px solid var(--color-hanko-ring);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  }

  .card.priority-should::before {
    background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.65), transparent 60%),
      var(--color-tag);
    border-color: var(--color-tag-ring);
  }

  .card.completed {
    opacity: 0.65;
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
    .card {
      transition: none;
    }
  }
</style>
