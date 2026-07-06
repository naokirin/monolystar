/**
 * 「今日」タブの抽出・並び替えロジック（仕様書 4.5）。
 *
 * 抽出条件:
 * - ワンショットタスク（recurrence.type === "none"）:
 *   未完了、かつ startDate が未設定または今日以前、かつ endDate が未設定または今日以降。
 * - 定期タスク（recurrence.type !== "none"）:
 *   `isRecurringTaskDueOn` で「今日該当」かつ「有効期間内」を判定し、
 *   さらに今日分の完了記録（Completions）が存在しないこと。
 *
 * 並び替え条件（優先順、4段階のタイブレーク）:
 * 1. 目印（marker）: true が false より上位
 * 2. 優先度（must > should）
 * 3. 締切の近さ（endDate + endTime。未設定は最下位）
 * 4. 開始日の早さ（startDate。未設定の扱いは下記コメント参照）
 */
import type { Completions, Task } from "../types";
import { buildEndDateTime, compareDateStr, todayStr } from "./dates";
import { isRecurringTaskDueOn } from "./recurrence";

function isOneShotTaskForToday(task: Task, dateStr: string): boolean {
  if (task.completed) return false;
  if (task.startDate !== null && compareDateStr(dateStr, task.startDate) < 0) {
    return false;
  }
  if (task.endDate !== null && compareDateStr(dateStr, task.endDate) > 0) {
    return false;
  }
  return true;
}

function isRecurringTaskForToday(
  task: Task,
  completions: Completions,
  dateStr: string,
): boolean {
  if (!isRecurringTaskDueOn(task, dateStr)) return false;
  const key = `${task.id}__${dateStr}`;
  return completions[key] === undefined;
}

/** 目印を比較用の数値に変換する（marker = true が上位＝小さい値）。 */
function markerRank(task: Task): number {
  return task.marker ? 0 : 1;
}

/** 優先度を比較用の数値に変換する（must が上位＝小さい値）。 */
function priorityRank(task: Task): number {
  return task.priority === "must" ? 0 : 1;
}

/**
 * 締切（endDate + endTime）を比較用の数値（エポックms）に変換する。
 * endDate が未設定の場合は仕様書の「締切未設定は最下位扱い」に従い +Infinity を返す。
 */
function deadlineRank(task: Task): number {
  if (task.endDate === null) return Infinity;
  return buildEndDateTime(task.endDate, task.endTime).getTime();
}

/**
 * 開始日の早さで2タスクを比較する（`compareDateStr` ベース）。
 * startDate が未設定の場合、開始日による制約がない＝いつでも着手できるタスクであり、
 * 「早く始められる」とみなして最上位（他のどの設定日より早い）として扱う。
 * これはタイブレークの最終段であり、他の基準（優先度・締切）が同点のときのみ効くため、
 * 「開始制約がないタスクを後回しにする理由がない」という考え方に基づく独自解釈。
 * （仕様書に startDate 未設定時の扱いの明記がないため、ここで明示する。）
 */
export function compareStartDate(a: Task, b: Task): number {
  if (a.startDate === null && b.startDate === null) return 0;
  if (a.startDate === null) return -1;
  if (b.startDate === null) return 1;
  return compareDateStr(a.startDate, b.startDate);
}

/**
 * 「今日」タブに表示すべきタスクを抽出し、仕様書4.5の並び替え条件でソートして返す。
 *
 * @param tasks 全タスク
 * @param completions 定期タスクの完了記録
 * @param dateStr 基準日（省略時は実行時点の今日）。テストで任意の日付を注入するために公開。
 */
export function getTodayTasks(
  tasks: Task[],
  completions: Completions,
  dateStr: string = todayStr(),
): Task[] {
  const filtered = tasks.filter((task) => {
    if (task.deletedAt !== null) return false;
    if (task.recurrence.type === "none") {
      return isOneShotTaskForToday(task, dateStr);
    }
    return isRecurringTaskForToday(task, completions, dateStr);
  });

  return [...filtered].sort((a, b) => {
    const markerDiff = markerRank(a) - markerRank(b);
    if (markerDiff !== 0) return markerDiff;

    const priorityDiff = priorityRank(a) - priorityRank(b);
    if (priorityDiff !== 0) return priorityDiff;

    const deadlineDiff = deadlineRank(a) - deadlineRank(b);
    if (deadlineDiff !== 0) return deadlineDiff;

    return compareStartDate(a, b);
  });
}
