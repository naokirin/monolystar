import { describe, expect, it } from "vitest";
import { createTask } from "./createTask";
import { getAllTasks, getDoneTasks, getRecurringTasks, isRecurringDoneToday } from "./tabLists";
import type { Task } from "../types";

function withOverrides(overrides: Partial<Task>): Task {
  return { ...createTask({ title: "t" }), ...overrides };
}

describe("getAllTasks", () => {
  it("excludes completed, deleted, and recurring tasks", () => {
    const oneshot = withOverrides({ id: "1", startDate: "2026-07-05" });
    const completed = withOverrides({ id: "2", completed: true, startDate: "2026-07-01" });
    const deleted = withOverrides({ id: "3", deletedAt: 123, startDate: "2026-07-01" });
    const recurring = withOverrides({ id: "4", recurrence: { type: "daily" } });

    const result = getAllTasks([oneshot, completed, deleted, recurring]);
    expect(result).toEqual([oneshot]);
  });

  it("sorts by startDate ascending", () => {
    const later = withOverrides({ id: "1", startDate: "2026-07-10" });
    const earlier = withOverrides({ id: "2", startDate: "2026-07-05" });
    const unset = withOverrides({ id: "3", startDate: null });

    const result = getAllTasks([later, earlier, unset]).map((t) => t.id);
    expect(result).toEqual(["3", "2", "1"]);
  });
});

describe("getDoneTasks", () => {
  it("only includes completed one-shot tasks, newest completedAt first", () => {
    const oldest = withOverrides({ id: "1", completed: true, completedAt: 100 });
    const newest = withOverrides({ id: "2", completed: true, completedAt: 300 });
    const middle = withOverrides({ id: "3", completed: true, completedAt: 200 });
    const incomplete = withOverrides({ id: "4", completed: false });
    const recurring = withOverrides({ id: "5", completed: true, recurrence: { type: "daily" } });

    const result = getDoneTasks([oldest, newest, middle, incomplete, recurring]).map((t) => t.id);
    expect(result).toEqual(["2", "3", "1"]);
  });
});

describe("getRecurringTasks", () => {
  it("includes only non-deleted recurring templates", () => {
    const daily = withOverrides({ id: "1", recurrence: { type: "daily" } });
    const oneshot = withOverrides({ id: "2", recurrence: { type: "none" } });
    const deletedRecurring = withOverrides({
      id: "3",
      recurrence: { type: "weekly", weekdays: [1] },
      deletedAt: 1,
    });

    const result = getRecurringTasks([daily, oneshot, deletedRecurring]);
    expect(result).toEqual([daily]);
  });
});

describe("isRecurringDoneToday", () => {
  it("returns true only when a completion record exists for the given date", () => {
    const task = withOverrides({ id: "1" });
    const completions = { "1__2026-07-04": { at: 100 } };
    expect(isRecurringDoneToday(task, completions, "2026-07-04")).toBe(true);
    expect(isRecurringDoneToday(task, completions, "2026-07-05")).toBe(false);
  });
});
