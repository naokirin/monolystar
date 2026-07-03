import { describe, expect, it } from "vitest";
import { createTask } from "./createTask";

describe("createTask", () => {
  it("applies quick-add defaults when only a title is given", () => {
    const task = createTask({ title: "牛乳を買う" });

    expect(task.title).toBe("牛乳を買う");
    expect(task.priority).toBe("should");
    expect(task.category).toBe("");
    expect(task.startDate).toBeNull();
    expect(task.endDate).toBeNull();
    expect(task.recurrence).toEqual({ type: "none" });
    expect(task.completed).toBe(false);
    expect(task.completedAt).toBeNull();
    expect(task.deletedAt).toBeNull();
    expect(task.notifiedStart).toBe(false);
    expect(task.notifiedEndSoon).toBe(false);
  });

  it("generates a unique id and timestamps", () => {
    const a = createTask({ title: "A" });
    const b = createTask({ title: "B" });
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBe(a.updatedAt);
  });

  it("respects explicit overrides from the detail form", () => {
    const task = createTask({
      title: "会議",
      priority: "must",
      category: "仕事",
      startDate: "2026-07-10",
      recurrence: { type: "weekly", weekday: 3 },
    });

    expect(task.priority).toBe("must");
    expect(task.category).toBe("仕事");
    expect(task.startDate).toBe("2026-07-10");
    expect(task.recurrence).toEqual({ type: "weekly", weekday: 3 });
  });
});
