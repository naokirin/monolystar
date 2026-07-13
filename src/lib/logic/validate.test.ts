import { describe, expect, it } from "vitest";
import { isCompletions, isPrefs, isTask, isTaskArray } from "./validate";
import type { Task } from "../types";

/** 検証用の妥当な Task を生成する（欠落許容フィールドも埋めた完全形）。 */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "タスク",
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

describe("isTask", () => {
  it("accepts a fully-populated valid task", () => {
    expect(isTask(makeTask())).toBe(true);
  });

  it("accepts weekly recurrence with valid weekdays", () => {
    expect(isTask(makeTask({ recurrence: { type: "weekly", weekdays: [0, 3, 6] } }))).toBe(true);
  });

  it("accepts a task missing marker (旧データ互換)", () => {
    const task = makeTask();
    delete (task as unknown as Record<string, unknown>).marker;
    expect(isTask(task)).toBe(true);
  });

  it("accepts a task missing notifiedStart / notifiedEndSoon (旧データ互換)", () => {
    const task = makeTask();
    delete (task as unknown as Record<string, unknown>).notifiedStart;
    delete (task as unknown as Record<string, unknown>).notifiedEndSoon;
    expect(isTask(task)).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isTask(null)).toBe(false);
    expect(isTask(42)).toBe(false);
    expect(isTask([])).toBe(false);
  });

  it("rejects an invalid priority", () => {
    expect(isTask(makeTask({ priority: "high" as unknown as Task["priority"] }))).toBe(false);
  });

  it("rejects an invalid recurrence type", () => {
    expect(
      isTask(makeTask({ recurrence: { type: "monthly" as unknown as "none" } })),
    ).toBe(false);
  });

  it("rejects weekdays out of range", () => {
    expect(isTask(makeTask({ recurrence: { type: "weekly", weekdays: [0, 7] } }))).toBe(false);
    expect(isTask(makeTask({ recurrence: { type: "weekly", weekdays: [-1] } }))).toBe(false);
  });

  it("rejects non-integer weekdays", () => {
    expect(isTask(makeTask({ recurrence: { type: "weekly", weekdays: [1.5] } }))).toBe(false);
  });

  it("rejects a marker of wrong type", () => {
    expect(isTask(makeTask({ marker: "yes" as unknown as boolean }))).toBe(false);
  });

  it("rejects wrong date field types", () => {
    expect(isTask(makeTask({ startDate: 20260713 as unknown as string }))).toBe(false);
  });

  it("rejects missing required fields", () => {
    const task = makeTask();
    delete (task as unknown as Record<string, unknown>).title;
    expect(isTask(task)).toBe(false);
  });

  it("rejects wrong completedAt type", () => {
    expect(isTask(makeTask({ completedAt: "now" as unknown as number }))).toBe(false);
  });
});

describe("isTaskArray", () => {
  it("accepts an array of valid tasks", () => {
    expect(isTaskArray([makeTask(), makeTask({ id: "t2" })])).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(isTaskArray([])).toBe(true);
  });

  it("rejects non-array values", () => {
    expect(isTaskArray({})).toBe(false);
    expect(isTaskArray(null)).toBe(false);
  });

  it("rejects an array of numbers", () => {
    expect(isTaskArray([1, 2, 3])).toBe(false);
  });

  it("rejects an array containing an invalid task", () => {
    expect(isTaskArray([makeTask(), { id: "bad" }])).toBe(false);
  });
});

describe("isCompletions", () => {
  it("accepts a valid completions map", () => {
    expect(isCompletions({ "t1__2026-07-13": { at: 123 } })).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(isCompletions({})).toBe(true);
  });

  it("rejects arrays and null", () => {
    expect(isCompletions(null)).toBe(false);
    expect(isCompletions([])).toBe(false);
  });

  it("rejects entries without a numeric at", () => {
    expect(isCompletions({ k: { at: "now" } })).toBe(false);
    expect(isCompletions({ k: {} })).toBe(false);
    expect(isCompletions({ k: 123 })).toBe(false);
  });
});

describe("isPrefs", () => {
  it("accepts valid prefs", () => {
    expect(isPrefs({ notif: false, farDeadlineThresholdDays: 7, updatedAt: 0 })).toBe(true);
  });

  it("accepts prefs missing farDeadlineThresholdDays (旧データ互換)", () => {
    expect(isPrefs({ notif: true, updatedAt: 5 })).toBe(true);
  });

  it("rejects non-boolean notif", () => {
    expect(isPrefs({ notif: 1, updatedAt: 0 })).toBe(false);
  });

  it("rejects non-number updatedAt", () => {
    expect(isPrefs({ notif: false, updatedAt: "0" })).toBe(false);
  });

  it("rejects non-number farDeadlineThresholdDays when present", () => {
    expect(isPrefs({ notif: false, farDeadlineThresholdDays: "7", updatedAt: 0 })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isPrefs(null)).toBe(false);
    expect(isPrefs([])).toBe(false);
  });
});
