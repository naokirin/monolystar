import { describe, expect, it } from "vitest";
import type { Completions, Task } from "../types";
import { getTodayTasks } from "./todaySort";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
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

const TODAY = "2024-01-10"; // 水曜日

describe("getTodayTasks - 抽出条件（ワンショット）", () => {
  it("未完了かつ日付範囲なしのタスクは対象になる", () => {
    const task = makeTask({ id: "t1" });
    expect(getTodayTasks([task], {}, TODAY).map((t) => t.id)).toEqual(["t1"]);
  });

  it("完了済みタスクは除外される", () => {
    const task = makeTask({ id: "t1", completed: true });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("削除済み（deletedAt !== null）のタスクは除外される", () => {
    const task = makeTask({ id: "t1", deletedAt: 12345 });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("startDateが今日より後のタスクは除外される", () => {
    const task = makeTask({ id: "t1", startDate: "2024-01-11" });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("startDateが今日以前のタスクは対象になる", () => {
    const task = makeTask({ id: "t1", startDate: "2024-01-10" });
    expect(getTodayTasks([task], {}, TODAY).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが今日より前のタスクは除外される", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-09" });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("endDateが今日以降のタスクは対象になる", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-10" });
    expect(getTodayTasks([task], {}, TODAY).map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("getTodayTasks - 抽出条件（定期タスク）", () => {
  it("該当曜日かつ完了記録なしなら対象になる", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [3] }, // 水曜日
    });
    expect(getTodayTasks([task], {}, TODAY).map((t) => t.id)).toEqual(["t1"]);
  });

  it("該当曜日でも今日分の完了記録があれば除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [3] },
    });
    const completions: Completions = { "t1__2024-01-10": { at: 1 } };
    expect(getTodayTasks([task], completions, TODAY)).toEqual([]);
  });

  it("該当曜日でなければ除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [4] }, // 木曜日
    });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("削除済み（deletedAt !== null）の定期タスクは除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      deletedAt: 12345,
    });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("有効期間外（開始前）なら除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      startDate: "2024-01-11",
    });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("有効期間外（終了後）なら除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      endDate: "2024-01-09",
    });
    expect(getTodayTasks([task], {}, TODAY)).toEqual([]);
  });

  it("有効期間内かつ完了記録なしのdailyタスクは対象になる", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });
    expect(getTodayTasks([task], {}, TODAY).map((t) => t.id)).toEqual(["t1"]);
  });

  it("隔週（biweekly）: 基準週から2週間おきの該当日のみ対象になる", () => {
    const base = { id: "t1", recurrence: { type: "biweekly" as const, weekdays: [3] }, startDate: "2024-01-03" };
    // 基準週（起点そのもの）
    expect(
      getTodayTasks([makeTask(base)], {}, "2024-01-03").map((t) => t.id),
    ).toEqual(["t1"]);
    // 1週間後（奇数週）は非該当
    expect(getTodayTasks([makeTask(base)], {}, "2024-01-10")).toEqual([]);
    // 2週間後（偶数週）は該当
    expect(
      getTodayTasks([makeTask(base)], {}, "2024-01-17").map((t) => t.id),
    ).toEqual(["t1"]);
  });
});

describe("getTodayTasks - 並び替え", () => {
  it("優先度が異なる場合は締切より優先度が勝つ", () => {
    // shouldだが締切が近いタスク vs mustだが締切が遠い/なしタスク
    const soon = makeTask({
      id: "should-soon",
      priority: "should",
      endDate: "2024-01-10",
      endTime: "09:00",
    });
    const mustNoDeadline = makeTask({
      id: "must-no-deadline",
      priority: "must",
    });
    expect(
      getTodayTasks([soon, mustNoDeadline], {}, TODAY).map((t) => t.id),
    ).toEqual(["must-no-deadline", "should-soon"]);
  });

  it("締切未設定タスクは締切設定タスクより下位（最下位）になる", () => {
    const withDeadline = makeTask({
      id: "with-deadline",
      endDate: "2024-01-20",
      endTime: "23:59",
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([noDeadline, withDeadline], {}, TODAY).map((t) => t.id),
    ).toEqual(["with-deadline", "no-deadline"]);
  });

  it("同一優先度なら締切が早い方が上位になる", () => {
    const early = makeTask({
      id: "early",
      endDate: "2024-01-10",
      endTime: "10:00",
    });
    const late = makeTask({
      id: "late",
      endDate: "2024-01-10",
      endTime: "18:00",
    });
    expect(
      getTodayTasks([late, early], {}, TODAY).map((t) => t.id),
    ).toEqual(["early", "late"]);
  });

  it("優先度・締切が同条件の場合は開始日が早い方が上位になる", () => {
    const earlyStart = makeTask({
      id: "early-start",
      endDate: "2024-01-20",
      startDate: "2024-01-01",
    });
    const lateStart = makeTask({
      id: "late-start",
      endDate: "2024-01-20",
      startDate: "2024-01-05",
    });
    expect(
      getTodayTasks([lateStart, earlyStart], {}, TODAY).map((t) => t.id),
    ).toEqual(["early-start", "late-start"]);
  });

  it("優先度・締切が同条件で開始日未設定の場合は開始日設定タスクより上位になる（独自解釈）", () => {
    const noStart = makeTask({ id: "no-start", endDate: "2024-01-20" });
    const withStart = makeTask({
      id: "with-start",
      endDate: "2024-01-20",
      startDate: "2024-01-05",
    });
    expect(
      getTodayTasks([withStart, noStart], {}, TODAY).map((t) => t.id),
    ).toEqual(["no-start", "with-start"]);
  });

  it("すべてのタイブレーク基準が完全同点の場合は元の配列順を維持する（安定ソート）", () => {
    const a = makeTask({ id: "a", endDate: "2024-01-20" });
    const b = makeTask({ id: "b", endDate: "2024-01-20" });
    const c = makeTask({ id: "c", endDate: "2024-01-20" });
    expect(
      getTodayTasks([a, b, c], {}, TODAY).map((t) => t.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("ワンショットと定期タスクが混在しても優先度・締切ルールで統一的に並ぶ", () => {
    const oneShotMust = makeTask({
      id: "oneshot-must",
      priority: "must",
      endDate: "2024-01-15",
    });
    const recurringMustSoonDeadline = makeTask({
      id: "recurring-must",
      priority: "must",
      recurrence: { type: "daily" },
      endDate: "2024-01-10",
      endTime: "08:00",
    });
    const oneShotShould = makeTask({
      id: "oneshot-should",
      priority: "should",
    });
    expect(
      getTodayTasks(
        [oneShotShould, oneShotMust, recurringMustSoonDeadline],
        {},
        TODAY,
      ).map((t) => t.id),
    ).toEqual(["recurring-must", "oneshot-must", "oneshot-should"]);
  });
});
