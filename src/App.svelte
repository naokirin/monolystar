<script lang="ts">
  import { tasks } from "./lib/stores/tasks";
  import { completions } from "./lib/stores/completions";
  import { DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS, prefs } from "./lib/stores/prefs";
  import { createTask, type NewTaskInput } from "./lib/logic/createTask";
  import { todayStr } from "./lib/logic/dates";
  import { getTodayTasks } from "./lib/logic/todaySort";
  import { getAllTasks, getDoneTasks, getRecurringTasks, isRecurringDoneToday } from "./lib/logic/tabLists";
  import { shouldNotifyEndSoon, shouldNotifyStart } from "./lib/logic/notifications";
  import { deliverNotification } from "./lib/logic/deliverNotification";
  import { mergeCompletions, mergePrefs, mergeTasks } from "./lib/logic/merge";
  import Header from "./lib/components/Header.svelte";
  import QuickAddBar from "./lib/components/QuickAddBar.svelte";
  import TaskList from "./lib/components/TaskList.svelte";
  import TaskFormModal from "./lib/components/TaskFormModal.svelte";
  import Tabs, { type TabDef } from "./lib/components/Tabs.svelte";
  import Toast, { type ToastMessage } from "./lib/components/Toast.svelte";
  import DataMenu, { type ImportChoice } from "./lib/components/DataMenu.svelte";
  import SettingsMenu from "./lib/components/SettingsMenu.svelte";
  import type { SyncFile, Task } from "./lib/types";

  const appName = "MONOLYSTAR";
  const tagline = "思いついた瞬間に、やることだけ。";

  // 書き出しファイル形式（SyncFile）が必須とする識別子。永続化はせず、
  // 書き出しのたびに一意な値であれば十分なためセッション内で1つ生成する。
  const deviceId = crypto.randomUUID();

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
          deliverNotification("MONOLYSTAR", `開始時刻になりました: ${next.title}`);
          next = { ...next, notifiedStart: true };
        }
        if (shouldNotifyEndSoon(next, now)) {
          deliverNotification("MONOLYSTAR", `締切が近づいています: ${next.title}`);
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

  // タブを開いたまま日付が変わった場合でも、リロードなしで「今日」タブの
  // 抽出・定期タスクの完了扱いが翌日の状態に切り替わるよう、実際の日付との
  // ズレを定期的に検知して `today` を更新する。tasks/completions が
  // 変化しない限り Svelte は再描画のきっかけを持たないため、他の派生値は
  // 必ずこの `today`（todayStr() の直接呼び出しではなく）を参照させる。
  const DATE_CHECK_INTERVAL_MS = 60_000;
  let today = $state(todayStr());

  $effect(() => {
    const intervalId = setInterval(() => {
      const current = todayStr();
      if (current !== today) today = current;
    }, DATE_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  });

  function handleToggleNotif() {
    if ($prefs.notif) {
      prefs.set({ ...$prefs, notif: false, updatedAt: Date.now() });
      return;
    }
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        prefs.set({ ...$prefs, notif: true, updatedAt: Date.now() });
      }
    });
  }

  function handleSaveSettings(farDeadlineThresholdDays: number) {
    prefs.set({ ...$prefs, farDeadlineThresholdDays, updatedAt: Date.now() });
    settingsMenuOpen = false;
  }

  type TabId = "today" | "all" | "done" | "recurring";
  let activeTab = $state<TabId>("today");

  const todayTasks = $derived(
    getTodayTasks(
      $tasks,
      $completions,
      today,
      $prefs.farDeadlineThresholdDays ?? DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS,
    ),
  );
  const allTasks = $derived(getAllTasks($tasks));
  const doneTasks = $derived(getDoneTasks($tasks));
  const recurringTasks = $derived(getRecurringTasks($tasks));

  // 完了タブは完了済みタスクが溜まり続けるため、既定は直近10件のみ表示し、
  // 「さらに読み込む」で一定件数ずつ表示範囲を広げる。
  const DONE_PAGE_SIZE = 10;
  let doneVisibleCount = $state(DONE_PAGE_SIZE);
  const visibleDoneTasks = $derived(doneTasks.slice(0, doneVisibleCount));
  const hasMoreDoneTasks = $derived(doneTasks.length > doneVisibleCount);

  function loadMoreDoneTasks() {
    doneVisibleCount += DONE_PAGE_SIZE;
  }

  // タブ順: ステータス（今日・完了）→ カテゴリ（すべて・定期タスク）の並び。
  const tabDefs = $derived<TabDef[]>([
    { id: "today", label: "今日", count: todayTasks.length },
    { id: "done", label: "完了", count: doneTasks.length },
    { id: "all", label: "すべて", count: allTasks.length },
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

  function handleToggleMarker(taskId: string) {
    tasks.update((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, marker: !task.marker, updatedAt: Date.now() }
          : task,
      ),
    );
  }

  function handleOpen(task: Task) {
    modalState = { task, initialTitle: "" };
  }

  function handleModalClose() {
    modalState = null;
  }

  /**
   * タスクの追加・更新を行う。新規追加時はここでモーダルを閉じる（明示的な
   * 「追加」ボタン押下による確定操作のため）。編集時はTaskFormModal側の
   * 自動保存から繰り返し呼ばれるため、ここではモーダルを閉じたりトースト
   * を出したりしない（都度モーダルが閉じてしまう・通知が連発するのを防ぐ）。
   * 編集モードのモーダルを閉じるのはTaskFormModal側のonCloseの役目。
   */
  function handleModalSave(taskId: string | null, input: NewTaskInput) {
    if (taskId === null) {
      tasks.update((current) => [...current, createTask(input)]);
      showToast("タスクを追加しました");
      modalState = null;
      return;
    }
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
    return isRecurringDoneToday(task, $completions, today);
  }

  let dataMenuOpen = $state(false);
  const isLocalEmpty = $derived($tasks.filter((task) => task.deletedAt === null).length === 0);

  function handleOpenDataMenu() {
    dataMenuOpen = true;
  }

  function handleCloseDataMenu() {
    dataMenuOpen = false;
  }

  let settingsMenuOpen = $state(false);

  function handleOpenSettings() {
    settingsMenuOpen = true;
  }

  function handleCloseSettings() {
    settingsMenuOpen = false;
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

  /**
   * ToDoリストをリセットする（未削除タスクをすべて論理削除）。
   * 個別削除（handleModalDelete）と同じく deletedAt を立てる。完了履歴（Completions）は
   * 削除済みタスクを参照するため表示されず、そのまま残しても無害。
   */
  function handleResetAll() {
    const now = Date.now();
    tasks.update((current) =>
      current.map((task) =>
        task.deletedAt === null ? { ...task, deletedAt: now, updatedAt: now } : task,
      ),
    );
    dataMenuOpen = false;
    showToast("ToDoリストをリセットしました");
  }
</script>

<main>
  <Header
    {appName}
    {tagline}
    notifEnabled={$prefs.notif}
    onToggleNotif={handleToggleNotif}
    onOpenDataMenu={handleOpenDataMenu}
    onOpenSettings={handleOpenSettings}
  />

  <QuickAddBar onAdd={handleAdd} onOpenDetail={handleOpenDetail} />

  <Tabs tabs={tabDefs} {activeTab} onSelect={(id) => (activeTab = id as TabId)} />

  <div class="tabpanel" role="tabpanel" id="tabpanel-today" aria-labelledby="tab-today" hidden={activeTab !== "today"}>
    <TaskList
      tasks={todayTasks}
      isCompleted={alwaysIncomplete}
      emptyMessage="今日やるべきタスクはありません。"
      onToggle={handleToggle}
      onToggleMarker={handleToggleMarker}
      onOpen={handleOpen}
    />
  </div>

  <div class="tabpanel" role="tabpanel" id="tabpanel-done" aria-labelledby="tab-done" hidden={activeTab !== "done"}>
    <TaskList
      tasks={visibleDoneTasks}
      isCompleted={alwaysComplete}
      emptyMessage="完了したタスクはまだありません。"
      onToggle={handleToggle}
      onToggleMarker={handleToggleMarker}
      onOpen={handleOpen}
    />
    {#if hasMoreDoneTasks}
      <button type="button" class="load-more" onclick={loadMoreDoneTasks}>
        さらに読み込む（残り{doneTasks.length - doneVisibleCount}件）
      </button>
    {/if}
  </div>

  <div class="tabpanel" role="tabpanel" id="tabpanel-all" aria-labelledby="tab-all" hidden={activeTab !== "all"}>
    <TaskList
      tasks={allTasks}
      isCompleted={alwaysIncomplete}
      emptyMessage="未完了のタスクはありません。"
      onToggle={handleToggle}
      onToggleMarker={handleToggleMarker}
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
      onToggleMarker={handleToggleMarker}
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
    {deviceId}
    tasks={$tasks}
    completions={$completions}
    prefs={$prefs}
    {isLocalEmpty}
    onImport={handleImport}
    onReset={handleResetAll}
    onError={handleImportError}
    onClose={handleCloseDataMenu}
  />
{/if}

{#if settingsMenuOpen}
  <SettingsMenu
    farDeadlineThresholdDays={$prefs.farDeadlineThresholdDays ?? DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS}
    onSave={handleSaveSettings}
    onClose={handleCloseSettings}
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

  .load-more {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-divider-on-bg);
    border-radius: 6px;
    background: transparent;
    color: var(--color-on-bg);
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .load-more:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .load-more {
      transition: none;
    }
  }
</style>
