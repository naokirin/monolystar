/**
 * 手動エクスポート/インポート用のファイル形式（仕様書 3.7）の生成・検証ユーティリティ。
 *
 * インポート時に外部から読み込む JSON は信頼できない入力として扱い、
 * 形式が不正な場合は必ず例外を投げて呼び出し側（UI）がエラーハンドリング
 * できるようにする。
 */
import type { Completions, Prefs, SyncFile, Task } from "../types";
import { isPrefs, isTask } from "./validate";

/** 同期ファイルの検証に失敗した場合に投げる例外。 */
export class InvalidSyncFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSyncFileError";
  }
}

/**
 * JSON のキーとして危険なプロトタイプ汚染用の名前（`__proto__` 等）。
 * completions のキーとして許容しない（多層防御。詳細は mergeCompletions 側の
 * コメントも参照）。
 */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** completions のキー形式（`{taskId}__{YYYY-MM-DD}`）を緩く検証する正規表現。 */
const COMPLETION_KEY_PATTERN = /^.+__\d{4}-\d{2}-\d{2}$/;

/**
 * 3.7 の同期ファイル形式でオブジェクトを生成する。
 * `exportedAt` を省略した場合は現在時刻（`Date.now()`）を用いる。
 */
export function createSyncFile(
  tasks: Task[],
  completions: Completions,
  prefs: Prefs,
  deviceId: string,
  exportedAt: number = Date.now(),
): SyncFile {
  return {
    schemaVersion: 1,
    exportedAt,
    deviceId,
    tasks,
    completions,
    prefs,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `isTask` で不正と判定された値について、どのフィールドが不正かを示す
 * 日本語メッセージを組み立てる（診断専用。判定ロジック自体は `validate.ts`
 * の `isTask` を単一の正とし、ここでは重複させない）。
 */
function describeInvalidTask(task: Record<string, unknown>): string {
  if (typeof task.id !== "string") return "id が不正です（文字列が必要）";
  if (typeof task.title !== "string") return "title が不正です（文字列が必要）";
  if (typeof task.detail !== "string") return "detail が不正です（文字列が必要）";
  if (task.priority !== "must" && task.priority !== "should") {
    return `priority が不正です（"must" または "should" が必要）`;
  }
  if (typeof task.category !== "string") return "category が不正です（文字列が必要）";

  const stringOrNullFields = ["startDate", "startTime", "endDate", "endTime"] as const;
  for (const field of stringOrNullFields) {
    const value = task[field];
    if (value !== null && typeof value !== "string") {
      return `${field} が不正です（文字列または null が必要）`;
    }
  }

  if (!isPlainObject(task.recurrence)) {
    return "recurrence が不正です（オブジェクトが必要）";
  }
  const recurrence = task.recurrence;
  const validRecurrenceTypes = ["none", "daily", "weekly", "biweekly"];
  if (!validRecurrenceTypes.includes(recurrence.type as string)) {
    return `recurrence.type が不正です（${validRecurrenceTypes.join(" / ")} のいずれかが必要）`;
  }
  if (
    recurrence.weekdays !== undefined &&
    !(
      Array.isArray(recurrence.weekdays) &&
      recurrence.weekdays.every(
        (n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6,
      )
    )
  ) {
    return "recurrence.weekdays が不正です（0〜6 の整数配列が必要）";
  }

  if (typeof task.completed !== "boolean") {
    return "completed が不正です（真偽値が必要）";
  }
  if (task.completedAt !== null && typeof task.completedAt !== "number") {
    return "completedAt が不正です（数値または null が必要）";
  }
  if (task.marker !== undefined && typeof task.marker !== "boolean") {
    return "marker が不正です（真偽値が必要）";
  }
  if (typeof task.createdAt !== "number") return "createdAt が不正です（数値が必要）";
  if (typeof task.updatedAt !== "number") return "updatedAt が不正です（数値が必要）";
  if (task.deletedAt !== null && typeof task.deletedAt !== "number") {
    return "deletedAt が不正です（数値または null が必要）";
  }
  if (task.notifiedStart !== undefined && typeof task.notifiedStart !== "boolean") {
    return "notifiedStart が不正です（真偽値が必要）";
  }
  if (task.notifiedEndSoon !== undefined && typeof task.notifiedEndSoon !== "boolean") {
    return "notifiedEndSoon が不正です（真偽値が必要）";
  }
  // ここまでの個別チェックをすべて通過したが isTask では不正と判定された
  // （チェック漏れ）場合のフォールバック。
  return "不明な検証エラーです";
}

function assertValidTask(task: unknown, index: number): asserts task is Task {
  if (!isPlainObject(task)) {
    throw new InvalidSyncFileError(
      `tasks[${index}] がオブジェクトではありません`,
    );
  }
  if (!isTask(task)) {
    throw new InvalidSyncFileError(
      `tasks[${index}].${describeInvalidTask(task)}`,
    );
  }
}

function assertNoDuplicateTaskIds(tasks: Task[]): void {
  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new InvalidSyncFileError(
        `tasks に重複した id があります: ${task.id}`,
      );
    }
    seen.add(task.id);
  }
}

function assertValidCompletions(
  completions: unknown,
): asserts completions is Completions {
  if (!isPlainObject(completions)) {
    throw new InvalidSyncFileError(
      "completions がオブジェクトではありません",
    );
  }
  for (const [key, value] of Object.entries(completions)) {
    if (DANGEROUS_KEYS.has(key)) {
      throw new InvalidSyncFileError(
        `completions のキーとして使用できない名前です: ${key}`,
      );
    }
    if (!COMPLETION_KEY_PATTERN.test(key)) {
      throw new InvalidSyncFileError(
        `completions["${key}"] のキー形式が不正です（{taskId}__{YYYY-MM-DD} が必要）`,
      );
    }
    if (!isPlainObject(value) || typeof value.at !== "number") {
      throw new InvalidSyncFileError(
        `completions["${key}"] が不正です（{ at: number } が必要）`,
      );
    }
  }
}

function assertValidPrefs(prefs: unknown): asserts prefs is Prefs {
  if (!isPlainObject(prefs)) {
    throw new InvalidSyncFileError("prefs がオブジェクトではありません");
  }
  if (!isPrefs(prefs)) {
    if (typeof prefs.notif !== "boolean") {
      throw new InvalidSyncFileError(
        "prefs.notif が不正です（真偽値が必要）",
      );
    }
    if (typeof prefs.updatedAt !== "number") {
      throw new InvalidSyncFileError(
        "prefs.updatedAt が不正です（数値が必要）",
      );
    }
    throw new InvalidSyncFileError(
      "prefs.farDeadlineThresholdDays が不正です（数値が必要）",
    );
  }
}

/**
 * 外部から読み込んだ JSON（`JSON.parse` 結果の `unknown`）を検証し、
 * `SyncFile` として返す。不正な形式の場合は `InvalidSyncFileError` を投げる。
 */
export function parseSyncFile(json: unknown): SyncFile {
  if (!isPlainObject(json)) {
    throw new InvalidSyncFileError(
      "同期ファイルの形式が不正です（オブジェクトが必要）",
    );
  }

  if (json.schemaVersion !== 1) {
    throw new InvalidSyncFileError(
      `未対応の schemaVersion です: ${String(json.schemaVersion)}`,
    );
  }

  if (typeof json.exportedAt !== "number") {
    throw new InvalidSyncFileError(
      "exportedAt が不正です（数値が必要）",
    );
  }

  if (typeof json.deviceId !== "string") {
    throw new InvalidSyncFileError(
      "deviceId が不正です（文字列が必要）",
    );
  }

  if (!Array.isArray(json.tasks)) {
    throw new InvalidSyncFileError("tasks が配列ではありません");
  }
  json.tasks.forEach((task, index) => assertValidTask(task, index));
  assertNoDuplicateTaskIds(json.tasks as Task[]);

  assertValidCompletions(json.completions);
  assertValidPrefs(json.prefs);

  return {
    schemaVersion: 1,
    exportedAt: json.exportedAt,
    deviceId: json.deviceId,
    tasks: json.tasks as Task[],
    completions: json.completions,
    prefs: json.prefs,
  };
}
