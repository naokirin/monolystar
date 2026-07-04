import { describe, expect, it, vi } from "vitest";
import type { Completions, Prefs, Task } from "../types";
import { InvalidSyncFileError } from "./syncFile";
import {
  SyncFileMissingError,
  SyncPermissionDeniedError,
  isFileSystemAccessSupported,
  runFileSync,
} from "./fileSync";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    title: "テスト",
    detail: "",
    priority: "should",
    category: "",
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    recurrence: { type: "none" },
    completed: false,
    completedAt: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
    ...overrides,
  };
}

const defaultPrefs: Prefs = { notif: false, updatedAt: 0 };
const emptyCompletions: Completions = {};

interface FakeHandleOptions {
  fileText?: string;
  permission?: "granted" | "denied" | "prompt";
  requestResult?: "granted" | "denied";
  getFileError?: Error;
}

function makeFakeHandle(options: FakeHandleOptions = {}) {
  const {
    fileText = "",
    permission = "granted",
    requestResult = "granted",
    getFileError,
  } = options;

  const write = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const queryPermission = vi.fn().mockResolvedValue(permission);
  const requestPermission = vi.fn().mockResolvedValue(requestResult);
  const getFile = getFileError
    ? vi.fn().mockRejectedValue(getFileError)
    : vi.fn().mockResolvedValue({ text: () => Promise.resolve(fileText) });
  const createWritable = vi.fn().mockResolvedValue({ write, close });

  const handle = {
    getFile,
    createWritable,
    queryPermission,
    requestPermission,
  } as unknown as FileSystemFileHandle;

  return { handle, write, close, queryPermission, requestPermission, getFile };
}

describe("isFileSystemAccessSupported", () => {
  it("showOpenFilePicker が window にあれば true を返す", () => {
    (window as unknown as Record<string, unknown>).showOpenFilePicker = vi.fn();
    expect(isFileSystemAccessSupported()).toBe(true);
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
  });

  it("showOpenFilePicker が window になければ false を返す", () => {
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    expect(isFileSystemAccessSupported()).toBe(false);
  });
});

describe("runFileSync - ハッピーパス", () => {
  it("ローカル・リモート双方のタスクをマージし、結果をファイルへ書き込む", async () => {
    const remoteTask = makeTask({ id: "remote-1", updatedAt: 10 });
    const remoteSyncFile = {
      schemaVersion: 1,
      exportedAt: 100,
      deviceId: "remote-device",
      tasks: [remoteTask],
      completions: emptyCompletions,
      prefs: defaultPrefs,
    };
    const { handle, write } = makeFakeHandle({
      fileText: JSON.stringify(remoteSyncFile),
    });

    const localTask = makeTask({ id: "local-1", updatedAt: 20 });
    const outcome = await runFileSync({
      handle,
      localTasks: [localTask],
      localCompletions: emptyCompletions,
      localPrefs: defaultPrefs,
      deviceId: "local-device",
    });

    expect(outcome.kind).toBe("synced");
    if (outcome.kind !== "synced") throw new Error("unreachable");
    expect(outcome.tasks.map((t) => t.id).sort()).toEqual(["local-1", "remote-1"]);
    expect(outcome.conflictCount).toBe(0);

    expect(write).toHaveBeenCalledTimes(1);
    const written = JSON.parse(write.mock.calls[0][0] as string);
    expect(written.schemaVersion).toBe(1);
    expect(written.tasks.map((t: Task) => t.id).sort()).toEqual(["local-1", "remote-1"]);
  });
});

describe("runFileSync - 新規作成直後の空ファイル", () => {
  it("空ファイルは「リモートデータなし」として扱い、ローカルの状態を書き出す", async () => {
    const { handle, write } = makeFakeHandle({ fileText: "" });
    const localTask = makeTask({ id: "local-1" });

    const outcome = await runFileSync({
      handle,
      localTasks: [localTask],
      localCompletions: emptyCompletions,
      localPrefs: defaultPrefs,
      deviceId: "local-device",
    });

    expect(outcome.kind).toBe("no-remote-file");
    expect(write).toHaveBeenCalledTimes(1);
    const written = JSON.parse(write.mock.calls[0][0] as string);
    expect(written.tasks.map((t: Task) => t.id)).toEqual(["local-1"]);
  });
});

describe("runFileSync - 不正なファイル", () => {
  it("不正なJSONの場合は InvalidSyncFileError を伝播する", async () => {
    const { handle } = makeFakeHandle({ fileText: "{not valid json" });

    await expect(
      runFileSync({
        handle,
        localTasks: [],
        localCompletions: emptyCompletions,
        localPrefs: defaultPrefs,
        deviceId: "local-device",
      }),
    ).rejects.toThrow();
  });

  it("スキーマ不正の場合は InvalidSyncFileError を伝播する", async () => {
    const { handle } = makeFakeHandle({ fileText: JSON.stringify({ schemaVersion: 2 }) });

    await expect(
      runFileSync({
        handle,
        localTasks: [],
        localCompletions: emptyCompletions,
        localPrefs: defaultPrefs,
        deviceId: "local-device",
      }),
    ).rejects.toThrow(InvalidSyncFileError);
  });
});

describe("runFileSync - 権限拒否", () => {
  it("読み書き権限が得られない場合は SyncPermissionDeniedError を投げ、読み書きを行わない", async () => {
    const { handle, getFile, write } = makeFakeHandle({
      permission: "prompt",
      requestResult: "denied",
    });

    await expect(
      runFileSync({
        handle,
        localTasks: [],
        localCompletions: emptyCompletions,
        localPrefs: defaultPrefs,
        deviceId: "local-device",
      }),
    ).rejects.toThrow(SyncPermissionDeniedError);

    expect(getFile).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});

describe("runFileSync - ファイル欠落", () => {
  it("getFile が NotFoundError を投げる場合は SyncFileMissingError を投げる", async () => {
    const notFound = new DOMException("not found", "NotFoundError");
    const { handle } = makeFakeHandle({ getFileError: notFound });

    await expect(
      runFileSync({
        handle,
        localTasks: [],
        localCompletions: emptyCompletions,
        localPrefs: defaultPrefs,
        deviceId: "local-device",
      }),
    ).rejects.toThrow(SyncFileMissingError);
  });
});
