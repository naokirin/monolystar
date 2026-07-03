<script lang="ts">
  import type { Task } from "../types";
  import TaskCard from "./TaskCard.svelte";

  interface Props {
    tasks: Task[];
    /** タスクごとの完了表示状態（ワンショットはcompleted、定期は当日の完了記録で呼び出し側が算出） */
    isCompleted: (task: Task) => boolean;
    emptyMessage: string;
    onToggle: (taskId: string) => void;
    onOpen: (task: Task) => void;
    completedLabel?: string;
  }

  const { tasks, isCompleted, emptyMessage, onToggle, onOpen, completedLabel }: Props = $props();
</script>

<div class="task-list">
  {#if tasks.length === 0}
    <p class="empty">{emptyMessage}</p>
  {:else}
    {#each tasks as task (task.id)}
      <TaskCard task={task} completed={isCompleted(task)} {completedLabel} {onToggle} {onOpen} />
    {/each}
  {/if}
</div>

<style>
  .task-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .empty {
    text-align: center;
    color: var(--color-muted, #666);
    padding: 2rem 1rem;
  }
</style>
