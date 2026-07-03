/**
 * 「すべて」「完了」「定期タスク」タブの抽出・並び替えロジック（仕様書 4.4）。
 * 「今日」タブは todaySort.ts を参照。
 */
import type { Completions, Task } from "../types";
import { compareStartDate } from "./todaySort";

function isAliveOneShot(task: Task): boolean {
  return task.deletedAt === null && task.recurrence.type === "none";
}

/** 「すべて」タブ: 未完了のワンショットタスクを開始日昇順で一覧。 */
export function getAllTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => isAliveOneShot(task) && !task.completed)
    .sort(compareStartDate);
}

/** 「完了」タブ: 完了済みワンショットタスクを完了日時の新しい順で一覧。 */
export function getDoneTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((task) => isAliveOneShot(task) && task.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
}

/** 「定期タスク」タブ: 登録済みの定期タスクテンプレート一覧。 */
export function getRecurringTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => task.deletedAt === null && task.recurrence.type !== "none");
}

/** 定期タスクについて、今日分の完了記録が存在するかどうか。 */
export function isRecurringDoneToday(task: Task, completions: Completions, dateStr: string): boolean {
  return completions[`${task.id}__${dateStr}`] !== undefined;
}
