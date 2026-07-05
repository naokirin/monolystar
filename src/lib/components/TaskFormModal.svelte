<script lang="ts">
  import { untrack } from "svelte";
  import type { NewTaskInput } from "../logic/createTask";
  import type { Priority, RecurrenceType, Task } from "../types";

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

  let dialogEl: HTMLDivElement | undefined;
  let titleInputEl: HTMLInputElement | undefined;

  $effect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    titleInputEl?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  });

  $effect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  });

  function focusableElements(): HTMLElement[] {
    if (!dialogEl) return [];
    return Array.from(
      dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const elements = focusableElements();
    if (elements.length === 0) return;
    const first = elements[0];
    const last = elements[elements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClick() {
    onClose();
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      titleError = "タイトルを入力してください";
      titleInputEl?.focus();
      return;
    }
    titleError = "";

    if (showWeekday && weekdays.length === 0) {
      weekdaysError = "曜日を1つ以上選択してください";
      return;
    }
    weekdaysError = "";

    const input: NewTaskInput = {
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

    onSave(task?.id ?? null, input);
  }

  function handleDelete() {
    if (!task) return;
    if (confirm(`「${task.title}」を削除しますか？`)) {
      onDelete(task.id);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop">
  <button
    type="button"
    class="backdrop-close"
    aria-hidden="true"
    tabindex="-1"
    onclick={handleBackdropClick}
  ></button>
  <div
    class="dialog"
    bind:this={dialogEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="task-form-title"
  >
    <h2 id="task-form-title">{isEdit ? "タスクを編集" : "タスクを追加"}</h2>

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
        {/if}
        <div class="actions-right">
          <button type="button" class="secondary" onclick={onClose}>キャンセル</button>
          <button type="submit" class="primary">{isEdit ? "保存" : "追加"}</button>
        </div>
      </div>
    </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 2rem 1rem;
    overflow-y: auto;
    z-index: 100;
  }

  /*
   * ビューポート全体に固定する。`.backdrop`（スクロールコンテナ）内で
   * position:absolute にすると、サイズがパディングボックス（ビューポート高さ）に
   * なりスクロール内容と一緒に上へ流れてしまい、ダイアログが画面より高いとき
   * 下部に背景・クリック領域が表示されない。fixed でスクロールに追従させず
   * 常に画面全体を覆う。
   */
  .backdrop-close {
    position: fixed;
    inset: 0;
    border: none;
    padding: 0;
    background: rgba(0, 0, 0, 0.4);
    cursor: default;
    z-index: 0;
  }

  .dialog {
    position: relative;
    z-index: 1;
    background: var(--color-surface, #fff);
    border-radius: 10px;
    padding: 1.5rem;
    width: 100%;
    max-width: 480px;
  }

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
