<script lang="ts">
  import { tasks } from "./lib/stores/tasks";
  import { createTask } from "./lib/logic/createTask";
  import QuickAddBar from "./lib/components/QuickAddBar.svelte";
  import TaskList from "./lib/components/TaskList.svelte";
  import type { Task } from "./lib/types";

  const appName = "やることだけ";
  const tagline = "思いついた瞬間に、やることだけ。";

  const visibleTasks = $derived(
    [...$tasks]
      .filter((task) => task.deletedAt === null)
      .sort((a, b) => a.createdAt - b.createdAt),
  );

  function handleAdd(title: string) {
    tasks.update((current) => [...current, createTask({ title })]);
  }

  function handleOpenDetail(_title: string) {
    // 詳細フォームモーダルは実装計画ステップ5で追加予定。
  }

  function handleToggle(taskId: string) {
    tasks.update((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const completed = !task.completed;
        return {
          ...task,
          completed,
          completedAt: completed ? Date.now() : null,
          updatedAt: Date.now(),
        };
      }),
    );
  }

  function handleOpen(_task: Task) {
    // 編集用の詳細フォームモーダルは実装計画ステップ5で追加予定。
  }

  function isCompleted(task: Task): boolean {
    return task.completed;
  }
</script>

<main>
  <header>
    <h1>{appName}</h1>
    <p class="tagline">{tagline}</p>
  </header>

  <QuickAddBar onAdd={handleAdd} onOpenDetail={handleOpenDetail} />

  <TaskList
    tasks={visibleTasks}
    {isCompleted}
    emptyMessage="タスクがありません。上の入力欄から追加しましょう。"
    onToggle={handleToggle}
    onOpen={handleOpen}
  />
</main>

<style>
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    font-family: "Zen Kaku Gothic New", sans-serif;
  }

  h1 {
    font-family: "Shippori Mincho", serif;
  }

  .tagline {
    color: var(--color-muted, #666);
  }
</style>
