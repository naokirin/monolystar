/**
 * 完了タスク・完了記録の一括削除（パージ）ロジック。
 *
 * ユーザーが明示的に「一定期間以上前に完了したタスクの一括削除」を実行する
 * ための純粋関数群。自動パージは行わない（副作用・store書き込みは呼び出し側の
 * 関心事とし、ここでは新しい配列／オブジェクトを返すだけにする）。
 *
 * 削除はいずれも物理削除（tombstoneを残さない）。復旧機能はないため、
 * 削除後に古いバックアップファイルをインポート（マージ）すると、削除済みの
 * タスクが復活しうる（仕様書8.5参照）。これはユーザーが受け入れたトレードオフ。
 */
import type { Completions, Task } from "../types";
import { diffInDays, todayStr } from "./dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** `{taskId}__{YYYY-MM-DD}` の日付部分が満たすべき形式。 */
const DATE_PART_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PurgeTasksResult {
  kept: Task[];
  removedCount: number;
}

/**
 * 完了済みワンショットタスク（completed && completedAt !== null）のうち、
 * 完了から `thresholdDays` 日以上経過したものを物理削除する。
 *
 * - 定期タスクや未完了タスクは対象外（そのまま `kept` に残す）。
 * - 境界: 完了からちょうど `thresholdDays` 日経過したものは削除する（>=）。
 *
 * @param now 経過日数の基準時刻（ミリ秒）。省略時は現在時刻。
 */
export function purgeOldDoneTasks(
  tasks: Task[],
  thresholdDays: number,
  now: number = Date.now(),
): PurgeTasksResult {
  const kept: Task[] = [];
  let removedCount = 0;

  for (const task of tasks) {
    const isDoneOneShot =
      task.recurrence.type === "none" &&
      task.completed &&
      task.completedAt !== null;

    if (isDoneOneShot) {
      const elapsedDays = (now - (task.completedAt as number)) / MS_PER_DAY;
      if (elapsedDays >= thresholdDays) {
        removedCount++;
        continue;
      }
    }
    kept.push(task);
  }

  return { kept, removedCount };
}

export interface PurgeCompletionsResult {
  kept: Completions;
  removedCount: number;
}

/**
 * 定期タスクの完了記録（Completions）のうち、キーの日付部分
 * （`{taskId}__{YYYY-MM-DD}`）が `thresholdDays` 日以上前のものを削除する。
 *
 * - 不正な形式のキー（日付部分が `YYYY-MM-DD` でない）は安全側で削除しない。
 * - 境界: ちょうど `thresholdDays` 日前の記録は削除する（>=）。
 * - プロトタイプ汚染を避けるため、結果は `Object.create(null)` 上で組み立てる。
 *
 * @param today 基準日（`YYYY-MM-DD`）。省略時はローカルの今日。
 */
export function purgeOldCompletions(
  completions: Completions,
  thresholdDays: number,
  today: string = todayStr(),
): PurgeCompletionsResult {
  const working: Record<string, { at: number }> = Object.create(null);
  let removedCount = 0;

  for (const [key, value] of Object.entries(completions)) {
    // taskId（UUID）には `__` を含まないため、最後の `__` 以降を日付部分とみなす。
    const sep = key.lastIndexOf("__");
    const datePart = sep === -1 ? "" : key.slice(sep + 2);

    if (!DATE_PART_RE.test(datePart)) {
      // 不正な形式のキーは削除対象と判断できないため残す（安全側）。
      working[key] = value;
      continue;
    }

    // diffInDays(a, b) = b - a なので、経過日数 = today - datePart。
    const elapsedDays = diffInDays(datePart, today);
    if (elapsedDays >= thresholdDays) {
      removedCount++;
      continue;
    }
    working[key] = value;
  }

  return { kept: { ...working }, removedCount };
}
