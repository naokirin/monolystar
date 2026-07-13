import { describe, expect, it } from "vitest";
import type { Completions, Prefs, Task } from "../types";
import {
  InvalidSyncFileError,
  createSyncFile,
  parseSyncFile,
} from "./syncFile";

function makeTask(overrides: Partial<Task> = {}): Task {
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
    marker: false,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
    ...overrides,
  };
}

const completions: Completions = { "t1__2024-01-01": { at: 100 } };
const prefs: Prefs = { notif: true, farDeadlineThresholdDays: 7, updatedAt: 100 };

describe("createSyncFile", () => {
  it("3.7 形式のオブジェクトを生成する", () => {
    const tasks = [makeTask()];
    const file = createSyncFile(tasks, completions, prefs, "device-1", 1234);

    expect(file).toEqual({
      schemaVersion: 1,
      exportedAt: 1234,
      deviceId: "device-1",
      tasks,
      completions,
      prefs,
    });
  });

  it("exportedAt を省略した場合は現在時刻を用いる", () => {
    const before = Date.now();
    const file = createSyncFile([], {}, prefs, "device-1");
    const after = Date.now();

    expect(file.exportedAt).toBeGreaterThanOrEqual(before);
    expect(file.exportedAt).toBeLessThanOrEqual(after);
  });
});

describe("parseSyncFile - 正常系", () => {
  it("正しい形式の JSON を SyncFile として返す", () => {
    const original = createSyncFile(
      [makeTask()],
      completions,
      prefs,
      "device-1",
      1234,
    );
    const roundTripped = JSON.parse(JSON.stringify(original));

    const parsed = parseSyncFile(roundTripped);

    expect(parsed).toEqual(original);
  });

  it("tasks / completions が空でも許容する", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    const parsed = parseSyncFile(JSON.parse(JSON.stringify(file)));

    expect(parsed.tasks).toEqual([]);
    expect(parsed.completions).toEqual({});
  });
});

describe("parseSyncFile - 異常系", () => {
  it("オブジェクトでない場合は例外を投げる", () => {
    expect(() => parseSyncFile(null)).toThrow(InvalidSyncFileError);
    expect(() => parseSyncFile("not an object")).toThrow(
      InvalidSyncFileError,
    );
    expect(() => parseSyncFile([1, 2, 3])).toThrow(InvalidSyncFileError);
  });

  it("schemaVersion が 1 でない場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({ ...file, schemaVersion: 2 }),
    ).toThrow(InvalidSyncFileError);
  });

  it("必須フィールド（deviceId）が欠落している場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    const { deviceId: _deviceId, ...rest } = file;
    expect(() => parseSyncFile(rest)).toThrow(InvalidSyncFileError);
  });

  it("tasks が配列でない場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({ ...file, tasks: "not-an-array" }),
    ).toThrow(InvalidSyncFileError);
  });

  it("tasks 内の要素に必須フィールドが欠けている場合は例外を投げる", () => {
    const file = createSyncFile([makeTask()], {}, prefs, "device-1", 1234);
    const brokenTask = { ...file.tasks[0] } as Record<string, unknown>;
    delete brokenTask.updatedAt;
    expect(() =>
      parseSyncFile({ ...file, tasks: [brokenTask] }),
    ).toThrow(InvalidSyncFileError);
  });

  it("completions の値が不正な場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({
        ...file,
        completions: { "t1__2024-01-01": { at: "invalid" } },
      }),
    ).toThrow(InvalidSyncFileError);
  });

  it("prefs が不正な場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({ ...file, prefs: { notif: "yes" } }),
    ).toThrow(InvalidSyncFileError);
  });
});
