<script lang="ts">
  import { tasks } from "./lib/stores/tasks";
  import { completions } from "./lib/stores/completions";
  import { prefs } from "./lib/stores/prefs";
  import { syncMeta } from "./lib/stores/syncMeta";
  import { syncFileHandle } from "./lib/stores/syncFileHandle";
  import { createTask, type NewTaskInput } from "./lib/logic/createTask";
  import { todayStr } from "./lib/logic/dates";
  import { getTodayTasks } from "./lib/logic/todaySort";
  import { getAllTasks, getDoneTasks, getRecurringTasks, isRecurringDoneToday } from "./lib/logic/tabLists";
  import { shouldNotifyEndSoon, shouldNotifyStart } from "./lib/logic/notifications";
  import { DEFAULT_SYNC_INTERVAL_MS, mergeCompletions, mergePrefs, mergeTasks } from "./lib/logic/merge";
  import {
    SyncFileMissingError,
    SyncPermissionDeniedError,
    isFileSystemAccessSupported,
    pickSyncFile,
    runFileSync,
  } from "./lib/logic/fileSync";
  import { InvalidSyncFileError } from "./lib/logic/syncFile";
  import Header from "./lib/components/Header.svelte";
  import QuickAddBar from "./lib/components/QuickAddBar.svelte";
  import TaskList from "./lib/components/TaskList.svelte";
  import TaskFormModal from "./lib/components/TaskFormModal.svelte";
  import Tabs, { type TabDef } from "./lib/components/Tabs.svelte";
  import Toast, { type ToastMessage } from "./lib/components/Toast.svelte";
  import DataMenu, { type ImportChoice } from "./lib/components/DataMenu.svelte";
  import type { SyncFile, Task } from "./lib/types";

  const appName = "MONOLYSTAR";
  const tagline = "思いついた瞬間に、やることだけ。";

  const TOAST_DURATION_MS = 2500;
  let toasts = $state<ToastMessage[]>([]);
  let nextToastId = 0;

  function showToast(text: string) {
    const id = nextToastId++;
    toasts = [...toasts, { id, text }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, TOAST_DURATION_MS);
  }

  const NOTIFICATION_CHECK_INTERVAL_MS = 60_000;

  function runNotificationCheck() {
    const now = Date.now();
    tasks.update((current) =>
      current.map((task) => {
        let next = task;
        if (shouldNotifyStart(next, now)) {
          new Notification("MONOLYSTAR", { body: `開始時刻になりました: ${next.title}` });
          next = { ...next, notifiedStart: true };
        }
        if (shouldNotifyEndSoon(next, now)) {
          new Notification("MONOLYSTAR", { body: `締切が近づいています: ${next.title}` });
          next = { ...next, notifiedEndSoon: true };
        }
        return next;
      }),
    );
  }

  $effect(() => {
    if (!$prefs.notif) return;
    if (typeof Notification === "undefined") return;

    runNotificationCheck();
    const intervalId = setInterval(runNotificationCheck, NOTIFICATION_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  });

  type SyncStatus = "off" | "synced" | "pending" | "conflict" | "error" | "permission-needed";
  let syncStatus = $state<SyncStatus>("off");

  async function performFileSync() {
    const handle = $syncFileHandle;
    if ($syncMeta.syncMode !== "file" || !handle) return;

    syncStatus = "pending";
    try {
      const outcome = await runFileSync({
        handle,
        localTasks: $tasks,
        localCompletions: $completions,
        localPrefs: $prefs,
        deviceId: $syncMeta.deviceId,
        syncIntervalMs: DEFAULT_SYNC_INTERVAL_MS,
      });

      if (outcome.kind === "synced") {
        tasks.set(outcome.tasks);
        completions.set(outcome.completions);
        prefs.set(outcome.prefs);
        if (outcome.conflictCount > 0) {
          showToast(`${outcome.conflictCount}件の競合を新しい更新で解決しました`);
          syncStatus = "conflict";
        } else {
          syncStatus = "synced";
        }
      } else {
        syncStatus = "synced";
      }
      syncMeta.update((m) => ({ ...m, lastSyncedAt: Date.now() }));
    } catch (err) {
      if (err instanceof SyncPermissionDeniedError) {
        syncStatus = "permission-needed";
        showToast("同期ファイルへのアクセス許可が必要です");
      } else if (err instanceof SyncFileMissingError) {
        syncStatus = "error";
        showToast("同期ファイルが見つかりません（移動または削除された可能性があります）");
      } else if (err instanceof InvalidSyncFileError) {
        syncStatus = "error";
        showToast(`同期ファイルの読み込みに失敗しました: ${err.message}`);
      } else {
        syncStatus = "error";
        showToast("同期に失敗しました");
      }
    }
  }

  $effect(() => {
    if ($syncMeta.syncMode !== "file" || !$syncFileHandle) return;

    performFileSync();
    const intervalId = setInterval(performFileSync, DEFAULT_SYNC_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") performFileSync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });

  async function handleSetupFileSync(mode: "open" | "save") {
    try {
      const handle = await pickSyncFile(mode);
      syncFileHandle.set(handle);
      syncMeta.update((m) => ({ ...m, syncMode: "file" }));
      await performFileSync();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      showToast("同期ファイルの設定に失敗しました");
    }
  }

  function handleDisableFileSync() {
    syncFileHandle.set(null);
    syncMeta.update((m) => ({ ...m, syncMode: null }));
    syncStatus = "off";
  }

  function handleToggleNotif() {
    if ($prefs.notif) {
      prefs.set({ notif: false, updatedAt: Date.now() });
      return;
    }
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        prefs.set({ notif: true, updatedAt: Date.now() });
      }
    });
  }

  type TabId = "today" | "all" | "done" | "recurring";
  let activeTab = $state<TabId>("today");

  const todayTasks = $derived(getTodayTasks($tasks, $completions));
  const allTasks = $derived(getAllTasks($tasks));
  const doneTasks = $derived(getDoneTasks($tasks));
  const recurringTasks = $derived(getRecurringTasks($tasks));

  const tabDefs = $derived<TabDef[]>([
    { id: "today", label: "今日", count: todayTasks.length },
    { id: "all", label: "すべて", count: allTasks.length },
    { id: "done", label: "完了", count: doneTasks.length },
    { id: "recurring", label: "定期タスク", count: recurringTasks.length },
  ]);

  const existingCategories = $derived(
    Array.from(new Set($tasks.map((task) => task.category).filter((c) => c !== ""))),
  );

  let modalState = $state<{ task: Task | null; initialTitle: string } | null>(null);

  function handleAdd(title: string) {
    tasks.update((current) => [...current, createTask({ title })]);
    showToast("タスクを追加しました");
  }

  function handleOpenDetail(title: string) {
    modalState = { task: null, initialTitle: title };
  }

  function toggleOneShotCompletion(taskId: string) {
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

  function toggleRecurringCompletionToday(taskId: string) {
    const key = `${taskId}__${todayStr()}`;
    completions.update((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = { at: Date.now() };
      }
      return next;
    });
  }

  function handleToggle(taskId: string) {
    const task = $tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.recurrence.type === "none") {
      toggleOneShotCompletion(taskId);
    } else {
      toggleRecurringCompletionToday(taskId);
    }
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
      showToast("タスクを追加しました");
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
      showToast("タスクを更新しました");
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
    showToast("タスクを削除しました");
  }

  function alwaysIncomplete(): boolean {
    return false;
  }

  function alwaysComplete(): boolean {
    return true;
  }

  function isRecurringCompletedToday(task: Task): boolean {
    return isRecurringDoneToday(task, $completions, todayStr());
  }

  let dataMenuOpen = $state(false);
  const isLocalEmpty = $derived($tasks.filter((task) => task.deletedAt === null).length === 0);

  function handleOpenDataMenu() {
    dataMenuOpen = true;
  }

  function handleCloseDataMenu() {
    dataMenuOpen = false;
  }

  /**
   * インポート時の3択（仕様書8.5）の解釈:
   * - remote: 読み込んだファイルの内容でローカルを上書きする。
   * - local: ローカルを変更せず、インポートを取り消す。
   * - merge: mergeTasks/mergeCompletions/mergePrefs（8.5）でLWWマージする。
   */
  function handleImport(choice: ImportChoice, file: SyncFile) {
    if (choice === "local") {
      dataMenuOpen = false;
      return;
    }

    if (choice === "remote") {
      tasks.set(file.tasks);
      completions.set(file.completions);
      prefs.set(file.prefs);
      showToast("データを読み込みました");
    } else {
      const { merged, conflictCount } = mergeTasks($tasks, file.tasks);
      tasks.set(merged);
      completions.set(mergeCompletions($completions, file.completions));
      prefs.set(mergePrefs($prefs, file.prefs));
      showToast(
        conflictCount > 0
          ? `${conflictCount}件の競合を新しい更新で解決しました`
          : "データをマージしました",
      );
    }
    dataMenuOpen = false;
  }

  function handleImportError(message: string) {
    showToast(message);
  }
</script>

<main>
  <Header
    {appName}
    {tagline}
    notifEnabled={$prefs.notif}
    onToggleNotif={handleToggleNotif}
    onOpenDataMenu={handleOpenDataMenu}
  />

  <QuickAddBar onAdd={handleAdd} onOpenDetail={handleOpenDetail} />

  <Tabs tabs={tabDefs} {activeTab} onSelect={(id) => (activeTab = id as TabId)} />

  <div class="tabpanel" role="tabpanel" id="tabpanel-today" aria-labelledby="tab-today" hidden={activeTab !== "today"}>
    <TaskList
      tasks={todayTasks}
      isCompleted={alwaysIncomplete}
      emptyMessage="今日やるべきタスクはありません。"
      onToggle={handleToggle}
      onOpen={handleOpen}
    />
  </div>

  <div class="tabpanel" role="tabpanel" id="tabpanel-all" aria-labelledby="tab-all" hidden={activeTab !== "all"}>
    <TaskList
      tasks={allTasks}
      isCompleted={alwaysIncomplete}
      emptyMessage="未完了のタスクはありません。"
      onToggle={handleToggle}
      onOpen={handleOpen}
    />
  </div>

  <div class="tabpanel" role="tabpanel" id="tabpanel-done" aria-labelledby="tab-done" hidden={activeTab !== "done"}>
    <TaskList
      tasks={doneTasks}
      isCompleted={alwaysComplete}
      emptyMessage="完了したタスクはまだありません。"
      onToggle={handleToggle}
      onOpen={handleOpen}
    />
  </div>

  <div
    class="tabpanel"
    role="tabpanel"
    id="tabpanel-recurring"
    aria-labelledby="tab-recurring"
    hidden={activeTab !== "recurring"}
  >
    <TaskList
      tasks={recurringTasks}
      isCompleted={isRecurringCompletedToday}
      completedLabel="今日完了"
      emptyMessage="定期タスクはまだ登録されていません。"
      onToggle={handleToggle}
      onOpen={handleOpen}
    />
  </div>
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

{#if dataMenuOpen}
  <DataMenu
    deviceId={$syncMeta.deviceId}
    tasks={$tasks}
    completions={$completions}
    prefs={$prefs}
    {isLocalEmpty}
    fileSyncSupported={isFileSystemAccessSupported()}
    syncMode={$syncMeta.syncMode}
    {syncStatus}
    lastSyncedAt={$syncMeta.lastSyncedAt}
    hasFileHandle={$syncFileHandle !== null}
    onSetupFileSync={handleSetupFileSync}
    onManualSync={performFileSync}
    onDisableFileSync={handleDisableFileSync}
    onImport={handleImport}
    onError={handleImportError}
    onClose={handleCloseDataMenu}
  />
{/if}

<Toast {toasts} />

<style>
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    font-family: "Zen Kaku Gothic New", sans-serif;
  }

  .tabpanel {
    padding-top: 0.25rem;
  }
</style>
