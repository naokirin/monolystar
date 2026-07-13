import { describe, expect, it } from "vitest";
import type { Completions, Task } from "../types";
import { purgeOldCompletions, purgeOldDoneTasks } from "./purge";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// 基準となる「今」。2026-04-01 12:00 UTC 相当（値そのものは境界計算にのみ使う）。
const NOW = Date.UTC(2026, 3, 1, 12, 0, 0);

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
    marker: false,
    ...overrides,
  };
}

describe("purgeOldDoneTasks", () => {
  it("完了からちょうどN日経過したタスクは削除する（境界: >=）", () => {
    const task = makeTask({
      id: "a",
      completed: true,
      completedAt: NOW - 90 * MS_PER_DAY,
    });
    const { kept, removedCount } = purgeOldDoneTasks([task], 90, NOW);
    expect(removedCount).toBe(1);
    expect(kept).toHaveLength(0);
  });

  it("完了からN-1日しか経過していないタスクは残す", () => {
    const task = makeTask({
      id: "a",
      completed: true,
      completedAt: NOW - 89 * MS_PER_DAY,
    });
    const { kept, removedCount } = purgeOldDoneTasks([task], 90, NOW);
    expect(removedCount).toBe(0);
    expect(kept).toHaveLength(1);
  });

  it("completed でも completedAt が null なら削除しない", () => {
    const task = makeTask({ id: "a", completed: true, completedAt: null });
    const { kept, removedCount } = purgeOldDoneTasks([task], 90, NOW);
    expect(removedCount).toBe(0);
    expect(kept).toHaveLength(1);
  });

  it("未完了タスクは古くても削除しない", () => {
    const task = makeTask({ id: "a", completed: false, completedAt: null });
    const { kept, removedCount } = purgeOldDoneTasks([task], 1, NOW);
    expect(removedCount).toBe(0);
    expect(kept).toHaveLength(1);
  });

  it("定期タスクは completed 相当でも対象外（そのまま残す）", () => {
    const task = makeTask({
      id: "a",
      recurrence: { type: "daily" },
      completed: true,
      completedAt: NOW - 365 * MS_PER_DAY,
    });
    const { kept, removedCount } = purgeOldDoneTasks([task], 90, NOW);
    expect(removedCount).toBe(0);
    expect(kept).toHaveLength(1);
  });

  it("空入力では何も削除しない", () => {
    const { kept, removedCount } = purgeOldDoneTasks([], 90, NOW);
    expect(removedCount).toBe(0);
    expect(kept).toHaveLength(0);
  });

  it("対象と非対象が混在しても、対象のみ削除し順序を保つ", () => {
    const old = makeTask({ id: "old", completed: true, completedAt: NOW - 100 * MS_PER_DAY });
    const recent = makeTask({ id: "recent", completed: true, completedAt: NOW - 10 * MS_PER_DAY });
    const active = makeTask({ id: "active" });
    const { kept, removedCount } = purgeOldDoneTasks([old, recent, active], 90, NOW);
    expect(removedCount).toBe(1);
    expect(kept.map((t) => t.id)).toEqual(["recent", "active"]);
  });
});

describe("purgeOldCompletions", () => {
  const today = "2026-04-01";

  it("しきい値以上前の完了記録を削除する（境界: ちょうどN日は削除）", () => {
    // 2026-04-01 の90日前は 2026-01-01。
    const completions: Completions = {
      "a__2026-01-01": { at: 1 }, // ちょうど90日前 → 削除
    };
    const { kept, removedCount } = purgeOldCompletions(completions, 90, today);
    expect(removedCount).toBe(1);
    expect(Object.keys(kept)).toHaveLength(0);
  });

  it("N-1日前の完了記録は残す", () => {
    const completions: Completions = {
      "a__2026-01-02": { at: 1 }, // 89日前 → 残す
    };
    const { kept, removedCount } = purgeOldCompletions(completions, 90, today);
    expect(removedCount).toBe(0);
    expect(kept["a__2026-01-02"]).toEqual({ at: 1 });
  });

  it("不正な形式のキーは安全側で削除しない", () => {
    const completions: Completions = {
      broken: { at: 1 },
      "a__not-a-date": { at: 2 },
      "a__2026-13-99xx": { at: 3 },
    };
    const { kept, removedCount } = purgeOldCompletions(completions, 1, today);
    expect(removedCount).toBe(0);
    expect(Object.keys(kept).sort()).toEqual(["a__2026-13-99xx", "a__not-a-date", "broken"]);
  });

  it("空入力では何も削除しない", () => {
    const { kept, removedCount } = purgeOldCompletions({}, 90, today);
    expect(removedCount).toBe(0);
    expect(Object.keys(kept)).toHaveLength(0);
  });

  it("新旧混在で古いものだけ削除する", () => {
    const completions: Completions = {
      "a__2025-01-01": { at: 1 }, // 十分古い → 削除
      "a__2026-03-31": { at: 2 }, // 1日前 → 残す
    };
    const { kept, removedCount } = purgeOldCompletions(completions, 90, today);
    expect(removedCount).toBe(1);
    expect(kept["a__2026-03-31"]).toEqual({ at: 2 });
    expect(kept["a__2025-01-01"]).toBeUndefined();
  });
});
