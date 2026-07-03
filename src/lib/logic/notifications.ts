/**
 * 開始通知・締切接近通知の判定ロジック（仕様書 5.2〜5.3）。
 * 定期タスクは対象外（5.4: テンプレートのため都度の日時を持たない）。
 */
import { buildEndDateTime, buildStartDateTime } from "./dates";
import type { Task } from "../types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 開始通知の対象かどうかを判定する（5.2）。
 * 対象: startDateが設定されたワンショットの未完了タスクで、
 * 現在時刻が開始日時を過ぎており、かつ未通知（notifiedStart=false）。
 */
export function shouldNotifyStart(task: Task, now: number = Date.now()): boolean {
  if (task.recurrence.type !== "none") return false;
  if (task.completed) return false;
  if (task.deletedAt !== null) return false;
  if (task.startDate === null) return false;
  if (task.notifiedStart) return false;

  const startAt = buildStartDateTime(task.startDate, task.startTime).getTime();
  return now >= startAt;
}

/**
 * 締切接近通知の対象かどうかを判定する（5.3）。
 * 対象: endDateが設定されたワンショットの未完了タスクで、
 * 締切までの残り時間が24時間以内、かつ未通知（notifiedEndSoon=false）。
 * 締切を過ぎた後にアプリを開いた場合も見逃し防止のため通知対象に含める（下限は設けない）。
 */
export function shouldNotifyEndSoon(task: Task, now: number = Date.now()): boolean {
  if (task.recurrence.type !== "none") return false;
  if (task.completed) return false;
  if (task.deletedAt !== null) return false;
  if (task.endDate === null) return false;
  if (task.notifiedEndSoon) return false;

  const endAt = buildEndDateTime(task.endDate, task.endTime).getTime();
  return endAt - now <= ONE_DAY_MS;
}
