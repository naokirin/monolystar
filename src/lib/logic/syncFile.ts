/**
 * 同期ファイル形式（仕様書 3.7）の生成・検証ユーティリティ。
 *
 * 手動エクスポート・ファイル同期・WebDAV 同期で共通の JSON スキーマを扱う。
 * インポート時に外部から読み込む JSON は信頼できない入力として扱い、
 * 形式が不正な場合は必ず例外を投げて呼び出し側（UI）がエラーハンドリング
 * できるようにする。
 */
import type { Completions, Prefs, SyncFile, Task } from "../types";

/** 同期ファイルの検証に失敗した場合に投げる例外。 */
export class InvalidSyncFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSyncFileError";
  }
}

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

function assertValidTask(task: unknown, index: number): asserts task is Task {
  if (!isPlainObject(task)) {
    throw new InvalidSyncFileError(
      `tasks[${index}] がオブジェクトではありません`,
    );
  }
  const requiredStringFields = ["id", "title"] as const;
  for (const field of requiredStringFields) {
    if (typeof task[field] !== "string") {
      throw new InvalidSyncFileError(
        `tasks[${index}].${field} が不正です（文字列が必要）`,
      );
    }
  }
  const requiredNumberFields = ["createdAt", "updatedAt"] as const;
  for (const field of requiredNumberFields) {
    if (typeof task[field] !== "number") {
      throw new InvalidSyncFileError(
        `tasks[${index}].${field} が不正です（数値が必要）`,
      );
    }
  }
  if (task.deletedAt !== null && typeof task.deletedAt !== "number") {
    throw new InvalidSyncFileError(
      `tasks[${index}].deletedAt が不正です（数値または null が必要）`,
    );
  }
  if (!isPlainObject(task.recurrence)) {
    throw new InvalidSyncFileError(
      `tasks[${index}].recurrence が不正です（オブジェクトが必要）`,
    );
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
  if (typeof prefs.notif !== "boolean") {
    throw new InvalidSyncFileError("prefs.notif が不正です（真偽値が必要）");
  }
  if (typeof prefs.updatedAt !== "number") {
    throw new InvalidSyncFileError(
      "prefs.updatedAt が不正です（数値が必要）",
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
