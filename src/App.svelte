<script lang="ts">
  import { tasks } from "./lib/stores/tasks";
  import { createTask, type NewTaskInput } from "./lib/logic/createTask";
  import QuickAddBar from "./lib/components/QuickAddBar.svelte";
  import TaskList from "./lib/components/TaskList.svelte";
  import TaskFormModal from "./lib/components/TaskFormModal.svelte";
  import type { Task } from "./lib/types";

  const appName = "やることだけ";
  const tagline = "思いついた瞬間に、やることだけ。";

  const visibleTasks = $derived(
    [...$tasks]
      .filter((task) => task.deletedAt === null)
      .sort((a, b) => a.createdAt - b.createdAt),
  );

  const existingCategories = $derived(
    Array.from(new Set($tasks.map((task) => task.category).filter((c) => c !== ""))),
  );

  let modalState = $state<{ task: Task | null; initialTitle: string } | null>(null);

  function handleAdd(title: string) {
    tasks.update((current) => [...current, createTask({ title })]);
  }

  function handleOpenDetail(title: string) {
    modalState = { task: null, initialTitle: title };
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

  function handleOpen(task: Task) {
    modalState = { task, initialTitle: "" };
  }

  function handleModalClose() {
    modalState = null;
  }

  function handleModalSave(taskId: string | null, input: NewTaskInput) {
    if (taskId === null) {
      tasks.update((current) => [...current, createTask(input)]);
    } else {
      tasks.update((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title: input.title,
                detail: input.detail ?? "",
                priority: input.priority ?? "should",
                category: input.category ?? "",
                startDate: input.startDate ?? null,
                startTime: input.startTime ?? null,
                endDate: input.endDate ?? null,
                endTime: input.endTime ?? null,
                recurrence: input.recurrence ?? { type: "none" },
                updatedAt: Date.now(),
              }
            : task,
        ),
      );
    }
    modalState = null;
  }

  function handleModalDelete(taskId: string) {
    tasks.update((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, deletedAt: Date.now(), updatedAt: Date.now() } : task,
      ),
    );
    modalState = null;
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

{#if modalState}
  {#key modalState}
  <TaskFormModal
    task={modalState.task}
    initialTitle={modalState.initialTitle}
    {existingCategories}
    onSave={handleModalSave}
    onDelete={handleModalDelete}
    onClose={handleModalClose}
  />
  {/key}
{/if}

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
