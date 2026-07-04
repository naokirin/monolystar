/**
 * 同期ファイル方式（File System Access API）の同期ロジック（仕様書 8.3.2）。
 *
 * ファイル読み書き・権限確認・マージ適用をまとめてオーケストレーションする。
 * マージルール自体は `merge.ts`、同期ファイル形式の生成/検証は `syncFile.ts` を
 * そのまま再利用し、ここでは「ファイルとのやり取り」と「エラーの種別分け」のみを担う。
 */
import type { Completions, Prefs, Task } from "../types";
import { mergeCompletions, mergePrefs, mergeTasks } from "./merge";
import { createSyncFile, parseSyncFile } from "./syncFile";

/** 同期ファイルへの読み書き権限が得られなかった場合に投げる例外。 */
export class SyncPermissionDeniedError extends Error {
  constructor(message = "同期ファイルへのアクセス許可が得られませんでした") {
    super(message);
    this.name = "SyncPermissionDeniedError";
  }
}

/** 同期ファイルが見つからない（移動・削除された等）場合に投げる例外。 */
export class SyncFileMissingError extends Error {
  constructor(message = "同期ファイルが見つかりません") {
    super(message);
    this.name = "SyncFileMissingError";
  }
}

/**
 * File System Access API に対応しているかどうかを判定する。
 * Safari/iOS 等の非対応環境では手動エクスポート/インポート（Phase 1）に
 * フォールバックする（仕様書 8.3.2）。
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

/**
 * 同期ファイルを選択する。
 * `mode: "open"` は既存ファイルを選択、`mode: "save"` は新規ファイルを作成する。
 */
export async function pickSyncFile(
  mode: "open" | "save",
): Promise<FileSystemFileHandle> {
  const types = [
    { description: "同期ファイル (JSON)", accept: { "application/json": [".json"] } },
  ];
  if (mode === "open") {
    const [handle] = await window.showOpenFilePicker({ types, multiple: false });
    return handle;
  }
  return window.showSaveFilePicker({
    types,
    suggestedName: "monolystar-sync.json",
  });
}

/**
 * 読み書き権限を確認し、未許可であれば再度要求する。
 * 拒否された場合は `false` を返す（例外は投げない。呼び出し側で判定する）。
 */
export async function ensureReadWritePermission(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const descriptor = { mode: "readwrite" as const };
  const current = await handle.queryPermission(descriptor);
  if (current === "granted") return true;
  const requested = await handle.requestPermission(descriptor);
  return requested === "granted";
}

/**
 * ファイルハンドルから同期ファイルを読み込む。
 * 新規作成直後の空ファイル（0バイト）は「リモートデータなし」として扱うため、
 * `null` を返す（`parseSyncFile` には渡さず、不正ファイルとして扱わない）。
 */
async function readSyncFileFromHandle(
  handle: FileSystemFileHandle,
): Promise<ReturnType<typeof parseSyncFile> | null> {
  let file: File;
  try {
    file = await handle.getFile();
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotFoundError") {
      throw new SyncFileMissingError();
    }
    throw err;
  }
  const text = await file.text();
  if (text.trim() === "") {
    return null;
  }
  return parseSyncFile(JSON.parse(text));
}

/** ファイルハンドルへ同期ファイルの内容を書き込む。 */
async function writeSyncFileToHandle(
  handle: FileSystemFileHandle,
  syncFile: ReturnType<typeof createSyncFile>,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(syncFile, null, 2));
  await writable.close();
}

export interface RunFileSyncParams {
  handle: FileSystemFileHandle;
  localTasks: Task[];
  localCompletions: Completions;
  localPrefs: Prefs;
  deviceId: string;
  syncIntervalMs?: number;
}

export type FileSyncOutcome =
  | {
      kind: "synced";
      tasks: Task[];
      completions: Completions;
      prefs: Prefs;
      conflictCount: number;
    }
  | { kind: "no-remote-file" };

/**
 * 同期ファイルとの1回分の同期（読込→マージ→書込）を実行する（仕様書 8.3.2）。
 *
 * 1. 読み書き権限を確認する（未許可なら `SyncPermissionDeniedError`）。
 * 2. リモートの同期ファイルを読み込む（新規作成直後の空ファイルは
 *    「リモートデータなし」として扱い、ローカルの状態をそのまま書き出す）。
 * 3. `mergeTasks`/`mergeCompletions`/`mergePrefs`（仕様書 8.5）でマージする。
 * 4. マージ結果を同期ファイル形式で書き戻す。
 */
export async function runFileSync(
  params: RunFileSyncParams,
): Promise<FileSyncOutcome> {
  const { handle, localTasks, localCompletions, localPrefs, deviceId, syncIntervalMs } =
    params;

  const permitted = await ensureReadWritePermission(handle);
  if (!permitted) {
    throw new SyncPermissionDeniedError();
  }

  const remote = await readSyncFileFromHandle(handle);

  if (remote === null) {
    const syncFile = createSyncFile(localTasks, localCompletions, localPrefs, deviceId);
    await writeSyncFileToHandle(handle, syncFile);
    return { kind: "no-remote-file" };
  }

  const { merged: tasks, conflictCount } = mergeTasks(
    localTasks,
    remote.tasks,
    syncIntervalMs,
  );
  const completions = mergeCompletions(localCompletions, remote.completions);
  const prefs = mergePrefs(localPrefs, remote.prefs);

  const syncFile = createSyncFile(tasks, completions, prefs, deviceId);
  await writeSyncFileToHandle(handle, syncFile);

  return { kind: "synced", tasks, completions, prefs, conflictCount };
}
