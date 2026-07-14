<script lang="ts">
  import { untrack } from "svelte";
  import type { NewTaskInput } from "../logic/createTask";
  import type { Priority, RecurrenceType, Task } from "../types";
  import ModalDialog from "./ModalDialog.svelte";

  interface Props {
    /** null = 新規追加モード。指定時は編集モード。 */
    task: Task | null;
    /** 新規追加モードでクイック追加欄から引き継ぐタイトル */
    initialTitle?: string;
    existingCategories: string[];
    onSave: (taskId: string | null, input: NewTaskInput) => void;
    onDelete: (taskId: string) => void;
    onClose: () => void;
  }

  const {
    task,
    initialTitle = "",
    existingCategories,
    onSave,
    onDelete,
    onClose,
  }: Props = $props();

  const isEdit = untrack(() => task !== null);

  // task/initialTitle は開くたびに親側で {#key} により再マウントされる前提のため、
  // ここではマウント時点の値をワンショットで読み取ってフォームの初期状態にする。
  const initial = untrack(() => ({
    title: task?.title ?? initialTitle,
    detail: task?.detail ?? "",
    priority: task?.priority ?? "should",
    category: task?.category ?? "",
    recurrenceType: task?.recurrence.type ?? "none",
    weekdays: task?.recurrence.weekdays ?? [new Date().getDay()],
    startDate: task?.startDate ?? "",
    startTime: task?.startTime ?? "",
    endDate: task?.endDate ?? "",
    endTime: task?.endTime ?? "",
  }));

  let title = $state(initial.title);
  let detail = $state(initial.detail);
  let priority = $state<Priority>(initial.priority);
  let category = $state(initial.category);
  let recurrenceType = $state<RecurrenceType>(initial.recurrenceType);
  let weekdays = $state<number[]>(initial.weekdays);
  let startDate = $state(initial.startDate);
  let startTime = $state(initial.startTime);
  let endDate = $state(initial.endDate);
  let endTime = $state(initial.endTime);

  let titleError = $state("");
  let weekdaysError = $state("");

  // 新規追加モードでの破棄確認（②）。編集モードは自動保存があるため対象外。
  let showDiscardConfirm = $state(false);
  let discardCancelEl = $state<HTMLButtonElement | undefined>();

  $effect(() => {
    if (showDiscardConfirm) discardCancelEl?.focus();
  });

  const isRecurring = $derived(recurrenceType !== "none");
  const showWeekday = $derived(recurrenceType === "weekly" || recurrenceType === "biweekly");
  const startLabel = $derived(isRecurring ? "期間の開始日" : "開始日（この日から表示）");
  const endLabel = $derived(isRecurring ? "期間の終了日" : "終了日（この日まで／締切）");

  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  function toggleWeekday(index: number) {
    if (weekdays.includes(index)) {
      weekdays = weekdays.filter((d) => d !== index);
    } else {
      weekdays = [...weekdays, index].sort((a, b) => a - b);
    }
  }

  let titleInputEl = $state<HTMLInputElement | undefined>();

  /**
   * バリデーションのうえ入力値を組み立てる。不正な場合はエラー状態をsetし、nullを返す。
   * 新規追加時の送信・編集時の自動保存の両方から呼ぶ共通処理。
   */
  function buildInputOrError(): NewTaskInput | null {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      titleError = "タイトルを入力してください";
      return null;
    }
    titleError = "";

    if (showWeekday && weekdays.length === 0) {
      weekdaysError = "曜日を1つ以上選択してください";
      return null;
    }
    weekdaysError = "";

    return {
      title: trimmedTitle,
      detail: detail.trim(),
      priority,
      category: category.trim(),
      startDate: startDate || null,
      startTime: startTime || null,
      endDate: endDate || null,
      endTime: endTime || null,
      recurrence:
        recurrenceType === "weekly" || recurrenceType === "biweekly"
          ? { type: recurrenceType, weekdays }
          : { type: recurrenceType },
    };
  }

  /** 現時点の入力がマウント時点の値と一致しているかどうか。 */
  function differsFromInitial(): boolean {
    return !(
      title === initial.title &&
      detail === initial.detail &&
      priority === initial.priority &&
      category === initial.category &&
      recurrenceType === initial.recurrenceType &&
      JSON.stringify(weekdays) === JSON.stringify(initial.weekdays) &&
      startDate === initial.startDate &&
      startTime === initial.startTime &&
      endDate === initial.endDate &&
      endTime === initial.endTime
    );
  }

  /**
   * 「一度でも入力が変更されたか」を保持するフラグ。
   * マウント時の値との単純比較（旧 isUnchanged 相当）だと、値を変更して保存された後に
   * マウント時点の値へ戻した瞬間に「変更なし」と誤判定され、以降の自動保存が止まって
   * しまう不具合があった（例: 優先度を should→must→should と戻すと、2回目の変更が
   * 保存されない）。一度でも変更があったことを記録し続けることで、その後の値が
   * たまたまマウント時と一致していても保存対象として扱う。
   */
  let hasChanged = $state(false);

  /** 編集モードでの自動保存を試みる。不正な入力の場合は何もしない（直前の保存内容を保持）。 */
  function attemptAutosave(): void {
    if (!task) return;
    const input = buildInputOrError();
    if (input) onSave(task.id, input);
  }

  // 編集モードのみ、全フィールドの変更を500msデバウンスして自動保存する（仕様書4.3）。
  // マウント直後（初期値のまま）は保存しない。連続入力中はタイマーをリセットし、
  // 入力が止まってから確定することで、保存の都度 updatedAt が更新され続けるのを防ぐ。
  const AUTOSAVE_DEBOUNCE_MS = 500;

  $effect(() => {
    // 依存を発生させるため全フィールドを読む。
    title;
    detail;
    priority;
    category;
    recurrenceType;
    weekdays;
    startDate;
    startTime;
    endDate;
    endTime;

    if (differsFromInitial()) hasChanged = true;
    if (!isEdit || !hasChanged) return;

    const timeoutId = setTimeout(attemptAutosave, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  });

  /**
   * モーダルを閉じる直前に、デバウンス待ちの変更があれば即座にフラッシュする。
   * デバウンス満了を待たずに閉じても最後の変更を失わないようにするため。
   */
  function handleCloseWithFlush(): void {
    if (isEdit && hasChanged) attemptAutosave();
    onClose();
  }

  /**
   * モーダルを閉じようとする操作（Escape・backdropクリック・キャンセル/閉じるボタン）の入口。
   * 新規追加モードで入力に変更がある場合は即座に閉じず、破棄確認UIを表示する（仕様の独自解釈②）。
   * それ以外（編集モード・新規追加で変更なし）は従来どおり即時クローズ。
   */
  function requestClose(): void {
    if (!isEdit && hasChanged) {
      showDiscardConfirm = true;
      return;
    }
    handleCloseWithFlush();
  }

  function confirmDiscard(): void {
    showDiscardConfirm = false;
    onClose();
  }

  function cancelDiscard(): void {
    showDiscardConfirm = false;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const input = buildInputOrError();
    if (!input) {
      titleInputEl?.focus();
      return;
    }
    onSave(task?.id ?? null, input);
  }

  function handleDelete() {
    if (!task) return;
    onDelete(task.id);
  }
</script>

<ModalDialog
  labelledBy="task-form-title"
  onClose={requestClose}
  maxWidth="480px"
  gap="0"
  getInitialFocusEl={() => titleInputEl}
>
  {#snippet children()}
    <h2 id="task-form-title">{isEdit ? "タスクを編集" : "タスクを追加"}</h2>

    {#if showDiscardConfirm}
      <div class="discard-confirm">
        <p class="error" role="alert">入力中の内容を破棄しますか？この操作は取り消せません。</p>
        <div class="actions-right">
          <button type="button" class="secondary" bind:this={discardCancelEl} onclick={cancelDiscard}>
            編集を続ける
          </button>
          <button type="button" class="danger" onclick={confirmDiscard}>破棄して閉じる</button>
        </div>
      </div>
    {:else}
    <form onsubmit={handleSubmit}>
      <div class="field">
        <label for="task-title">タイトル</label>
        <input
          id="task-title"
          type="text"
          bind:value={title}
          bind:this={titleInputEl}
          maxlength="200"
          required
          aria-invalid={titleError ? "true" : undefined}
          aria-describedby={titleError ? "task-title-error" : undefined}
        />
        {#if titleError}
          <p id="task-title-error" class="error" role="alert">{titleError}</p>
        {/if}
      </div>

      <div class="field">
        <label for="task-detail">詳細（任意）</label>
        <textarea id="task-detail" bind:value={detail} rows="3"></textarea>
      </div>

      <div class="field">
        <span id="task-priority-label" class="group-label">優先度</span>
        <div class="radio-group" role="radiogroup" aria-labelledby="task-priority-label">
          <label>
            <input type="radio" name="priority" value="must" bind:group={priority} />
            必須
          </label>
          <label>
            <input type="radio" name="priority" value="should" bind:group={priority} />
            できれば
          </label>
        </div>
      </div>

      <div class="field">
        <label for="task-category">カテゴリ（任意）</label>
        <input id="task-category" type="text" bind:value={category} list="category-suggestions" />
        <datalist id="category-suggestions">
          {#each existingCategories as c (c)}
            <option value={c}></option>
          {/each}
        </datalist>
      </div>

      <div class="field">
        <label for="task-recurrence">繰り返し</label>
        <select id="task-recurrence" bind:value={recurrenceType}>
          <option value="none">なし</option>
          <option value="daily">毎日</option>
          <option value="weekly">毎週</option>
          <option value="biweekly">隔週</option>
        </select>
      </div>

      {#if showWeekday}
        <div class="field">
          <span id="task-weekday-label" class="group-label">曜日（複数選択可）</span>
          <div class="weekday-group" role="group" aria-labelledby="task-weekday-label">
            {#each weekdayLabels as label, index (index)}
              <label>
                <input
                  type="checkbox"
                  checked={weekdays.includes(index)}
                  onchange={() => toggleWeekday(index)}
                />
                {label}
              </label>
            {/each}
          </div>
          {#if weekdaysError}
            <p class="error" role="alert">{weekdaysError}</p>
          {/if}
        </div>
      {/if}

      <div class="field-row">
        <div class="field">
          <label for="task-start-date">{startLabel}</label>
          <input id="task-start-date" type="date" bind:value={startDate} />
        </div>
        <div class="field">
          <label for="task-start-time">開始時刻（任意）</label>
          <input id="task-start-time" type="time" bind:value={startTime} />
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="task-end-date">{endLabel}</label>
          <input id="task-end-date" type="date" bind:value={endDate} />
        </div>
        <div class="field">
          <label for="task-end-time">終了時刻（任意）</label>
          <input id="task-end-time" type="time" bind:value={endTime} />
        </div>
      </div>

      <div class="actions">
        {#if isEdit}
          <button type="button" class="danger" onclick={handleDelete}>削除</button>
          <div class="actions-right">
            <button type="button" class="secondary" onclick={requestClose}>閉じる</button>
          </div>
        {:else}
          <div class="actions-right">
            <button type="button" class="secondary" onclick={requestClose}>キャンセル</button>
            <button type="submit" class="primary">追加</button>
          </div>
        {/if}
      </div>
    </form>
    {/if}
  {/snippet}
</ModalDialog>

<style>
  h2 {
    margin: 0 0 1rem;
    font-family: "Shippori Mincho", serif;
  }

  .field {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  /*
   * ラベル（開始日／終了日）とインプットをそれぞれ独立した行として
   * 縦に揃える。.field 側を display:contents にして子要素（label/input）を
   * 直接このグリッドに参加させ、grid-auto-flow:column により
   * 「ラベル行→インプット行」の順で列ごとに流し込むことで、
   * 片方のラベルだけ折り返して2行になっても、インプットの縦位置が
   * ズレないようにする。
   */
  .field-row {
    display: grid;
    /* minmax(0, 1fr): 1fr のみだとトラックが内容の最小幅（min-content）未満に
       縮まず、ラベルが折り返されずにはみ出すことがあるため、0まで縮められるようにする。 */
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto auto;
    grid-auto-flow: column;
    column-gap: 0.75rem;
    row-gap: 0.3rem;
    margin-bottom: 1rem;
  }

  .field-row .field {
    display: contents;
  }

  label {
    font-size: 0.875rem;
  }

  .group-label {
    font-size: 0.875rem;
  }

  input[type="text"],
  input[type="date"],
  input[type="time"],
  select,
  textarea {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.5rem;
    border: 2px solid var(--color-border);
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    background: var(--color-surface);
    color: var(--color-ink);
  }

  .radio-group,
  .weekday-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .radio-group label,
  .weekday-group label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .error {
    color: var(--color-warning-text, #a12b2b);
    font-size: 0.8rem;
    margin: 0;
  }

  .discard-confirm {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .discard-confirm .error {
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
  }

  .actions-right {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-surface);
  }

  .secondary {
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    color: var(--color-ink);
  }

  .danger {
    background: transparent;
    color: var(--color-warning-text, #a12b2b);
    text-decoration: underline;
  }
</style>
