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
        <span class="badge" class:badge-warning={deadlineSoon}>{dateRange}</span>
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
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--color-surface, #fff);
    border-left: 4px solid transparent;
    cursor: pointer;
    transition: opacity 0.15s ease;
  }

  .card.priority-must {
    border-left-color: var(--color-must, #d64545);
  }

  .card.priority-should {
    border-left-color: var(--color-should, #e0b13a);
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
    border: 2px solid var(--color-muted, #999);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-accent, #2a7a4f);
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
    font-family: "Roboto Mono", monospace;
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: var(--color-badge-bg, #f0f0f0);
    color: var(--color-badge-text, #444);
  }

  .badge-warning {
    background: var(--color-warning-bg, #fdeaea);
    color: var(--color-warning-text, #a12b2b);
  }

  .badge-done {
    background: var(--color-accent-bg, #e6f2ec);
    color: var(--color-accent, #2a7a4f);
  }

  .detail {
    margin: 0.4rem 0 0;
    font-size: 0.875rem;
    color: var(--color-muted, #666);
    white-space: pre-wrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
  }
</style>
