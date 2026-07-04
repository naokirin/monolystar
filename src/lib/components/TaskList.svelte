<script lang="ts">
  import { flip } from "svelte/animate";
  import type { TransitionConfig } from "svelte/transition";
  import { prefersReducedMotion } from "../logic/motion";
  import type { Task } from "../types";
  import TaskCard from "./TaskCard.svelte";

  /**
   * 完了・削除などでリストから外れるカードの退場アニメーション。
   * これによりワンショットタスクを完了した瞬間もカードが即座に消えず、
   * 判子スタンプ演出を見せつつ紙が剥がれるように退場する。
   * 「視差効果を減らす」設定時は duration 0（アニメなし）。
   */
  function leave(_node: Element): TransitionConfig {
    return {
      duration: prefersReducedMotion() ? 0 : 420,
      css: (t) =>
        `opacity: ${t}; transform: translateY(${(1 - t) * -6}px) scale(${0.98 + t * 0.02});`,
    };
  }

  interface Props {
    tasks: Task[];
    /** タスクごとの完了表示状態（ワンショットはcompleted、定期は当日の完了記録で呼び出し側が算出） */
    isCompleted: (task: Task) => boolean;
    emptyMessage: string;
    onToggle: (taskId: string) => void;
    onToggleMarker: (taskId: string) => void;
    onOpen: (task: Task) => void;
    completedLabel?: string;
  }

  const { tasks, isCompleted, emptyMessage, onToggle, onToggleMarker, onOpen, completedLabel }: Props =
    $props();

  // 「視差効果を減らす」設定時は並び替えアニメを無効化する（duration 0）。
  const flipDuration = $derived(prefersReducedMotion() ? 0 : 220);
</script>

<div class="task-list">
  {#if tasks.length === 0}
    <p class="empty">{emptyMessage}</p>
  {:else}
    {#each tasks as task (task.id)}
      <div animate:flip={{ duration: flipDuration }} out:leave>
        <TaskCard
          task={task}
          completed={isCompleted(task)}
          {completedLabel}
          {onToggle}
          {onToggleMarker}
          {onOpen}
        />
      </div>
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
    color: var(--color-on-bg-muted);
    padding: 2rem 1rem;
  }
</style>
