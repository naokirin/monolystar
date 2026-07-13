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

  it("prefs.farDeadlineThresholdDays の型が不正な場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({
        ...file,
        prefs: { ...prefs, farDeadlineThresholdDays: "7" },
      }),
    ).toThrow(InvalidSyncFileError);
  });

  it("priority が不正な値の場合は例外を投げる", () => {
    const file = createSyncFile(
      [makeTask({ priority: "urgent" as unknown as Task["priority"] })],
      {},
      prefs,
      "device-1",
      1234,
    );
    expect(() => parseSyncFile(file)).toThrow(InvalidSyncFileError);
  });

  it("recurrence.type が不正な値の場合は例外を投げる", () => {
    const file = createSyncFile(
      [makeTask({ recurrence: { type: "monthly" as never } })],
      {},
      prefs,
      "device-1",
      1234,
    );
    expect(() => parseSyncFile(file)).toThrow(InvalidSyncFileError);
  });

  it("recurrence.weekdays が範囲外の場合は例外を投げる", () => {
    const file = createSyncFile(
      [makeTask({ recurrence: { type: "weekly", weekdays: [0, 7] } })],
      {},
      prefs,
      "device-1",
      1234,
    );
    expect(() => parseSyncFile(file)).toThrow(InvalidSyncFileError);
  });

  it("detail の型が不正な場合は例外を投げる", () => {
    const file = createSyncFile(
      [makeTask({ detail: 123 as unknown as string })],
      {},
      prefs,
      "device-1",
      1234,
    );
    expect(() => parseSyncFile(file)).toThrow(InvalidSyncFileError);
  });

  it("tasks に重複した id がある場合は例外を投げる", () => {
    const file = createSyncFile(
      [makeTask({ id: "t1" }), makeTask({ id: "t1" })],
      {},
      prefs,
      "device-1",
      1234,
    );
    expect(() => parseSyncFile(file)).toThrow(InvalidSyncFileError);
  });

  it("completions のキー形式が不正な場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    expect(() =>
      parseSyncFile({
        ...file,
        completions: { "invalid-key": { at: 100 } },
      }),
    ).toThrow(InvalidSyncFileError);
  });

  it("completions のキーが __proto__ の場合は例外を投げる", () => {
    const file = createSyncFile([], {}, prefs, "device-1", 1234);
    const malicious = JSON.parse(
      '{"__proto__": {"at": 100}}',
    ) as Record<string, unknown>;
    expect(() =>
      parseSyncFile({ ...file, completions: malicious }),
    ).toThrow(InvalidSyncFileError);
  });

  it("旧形式（marker 等が欠落したタスク）は正常に読み込める", () => {
    const oldTask = makeTask() as unknown as Record<string, unknown>;
    delete oldTask.marker;
    delete oldTask.notifiedStart;
    delete oldTask.notifiedEndSoon;
    const oldPrefs: Record<string, unknown> = { notif: true, updatedAt: 100 };
    const file = createSyncFile(
      [oldTask as unknown as Task],
      completions,
      oldPrefs as unknown as Prefs,
      "device-1",
      1234,
    );

    const parsed = parseSyncFile(JSON.parse(JSON.stringify(file)));

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.prefs.notif).toBe(true);
  });
});
