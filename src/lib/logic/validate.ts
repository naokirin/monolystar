/**
 * localStorage やインポートファイルから読み込んだ信頼できない `unknown` 値を
 * アプリのドメイン型として検証する型ガード群。
 *
 * 永続化層（`src/lib/stores/persist.ts`）のフォールバック判定と、インポート検証
 * （`src/lib/logic/syncFile.ts`）の双方から再利用できるよう、型ごとの単品ガードとして書く。
 * 旧バージョンのデータ互換のため、後から追加したフィールドは欠落（undefined）を許容する。
 */
import type { Completions, Prefs, Priority, Recurrence, RecurrenceType, Task } from "../types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** string または null（日付文字列フィールド用。形式までは検証しない）。 */
function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** number または null。 */
function isNumberOrNull(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

/** boolean または undefined（旧データに無いフィールド用）。 */
function isBooleanOrUndefined(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isPriority(value: unknown): value is Priority {
  return value === "must" || value === "should";
}

function isRecurrenceType(value: unknown): value is RecurrenceType {
  return value === "none" || value === "daily" || value === "weekly" || value === "biweekly";
}

function isWeekdays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6)
  );
}

function isRecurrence(value: unknown): value is Recurrence {
  if (!isPlainObject(value)) return false;
  if (!isRecurrenceType(value.type)) return false;
  // weekdays は存在すれば 0〜6 の整数配列（weekly / biweekly で使用）。欠落は許容。
  if (value.weekdays !== undefined && !isWeekdays(value.weekdays)) return false;
  return true;
}

/** 単一の Task 値を検証する。全フィールドの型を確認する。 */
export function isTask(value: unknown): value is Task {
  if (!isPlainObject(value)) return false;

  if (typeof value.id !== "string") return false;
  if (typeof value.title !== "string") return false;
  if (typeof value.detail !== "string") return false;
  if (!isPriority(value.priority)) return false;
  if (typeof value.category !== "string") return false;

  if (!isStringOrNull(value.startDate)) return false;
  if (!isStringOrNull(value.startTime)) return false;
  if (!isStringOrNull(value.endDate)) return false;
  if (!isStringOrNull(value.endTime)) return false;

  if (!isRecurrence(value.recurrence)) return false;

  if (typeof value.completed !== "boolean") return false;
  if (!isNumberOrNull(value.completedAt)) return false;

  // marker は旧データに無い場合があるため欠落（undefined）を許容する
  // （TaskCard.svelte が truthy 判定で吸収している前提を踏襲）。
  if (!isBooleanOrUndefined(value.marker)) return false;

  if (typeof value.createdAt !== "number") return false;
  if (typeof value.updatedAt !== "number") return false;
  if (!isNumberOrNull(value.deletedAt)) return false;

  // notifiedStart / notifiedEndSoon も旧データ互換のため欠落を許容する。
  if (!isBooleanOrUndefined(value.notifiedStart)) return false;
  if (!isBooleanOrUndefined(value.notifiedEndSoon)) return false;

  return true;
}

/** Task の配列を検証する。 */
export function isTaskArray(value: unknown): value is Task[] {
  return Array.isArray(value) && value.every(isTask);
}

/** Completions（各値が `{ at: number }`）を検証する。キー形式の厳密チェックはしない。 */
export function isCompletions(value: unknown): value is Completions {
  if (!isPlainObject(value)) return false;
  for (const entry of Object.values(value)) {
    if (!isPlainObject(entry) || typeof entry.at !== "number") return false;
  }
  return true;
}

/** Prefs を検証する。farDeadlineThresholdDays は旧データに無い場合があるため欠落を許容する。 */
export function isPrefs(value: unknown): value is Prefs {
  if (!isPlainObject(value)) return false;
  if (typeof value.notif !== "boolean") return false;
  if (typeof value.updatedAt !== "number") return false;
  if (value.farDeadlineThresholdDays !== undefined && typeof value.farDeadlineThresholdDays !== "number") {
    return false;
  }
  return true;
}
