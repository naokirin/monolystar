import { describe, expect, it } from "vitest";
import { createTask } from "./createTask";
import {
  resetNotificationFlagsOnEdit,
  shouldNotifyEndSoon,
  shouldNotifyStart,
} from "./notifications";
import type { Task } from "../types";

function withOverrides(overrides: Partial<Task>): Task {
  return { ...createTask({ title: "t" }), ...overrides };
}

describe("shouldNotifyStart", () => {
  it("returns true once the start date/time has passed and not yet notified", () => {
    const task = withOverrides({ startDate: "2026-07-04", startTime: "09:00" });
    const now = new Date(2026, 6, 4, 9, 0, 0).getTime();
    expect(shouldNotifyStart(task, now)).toBe(true);
  });

  it("returns false before the start date/time", () => {
    const task = withOverrides({ startDate: "2026-07-04", startTime: "09:00" });
    const now = new Date(2026, 6, 4, 8, 59, 0).getTime();
    expect(shouldNotifyStart(task, now)).toBe(false);
  });

  it("defaults start time to 00:00 when unset", () => {
    const task = withOverrides({ startDate: "2026-07-04", startTime: null });
    const justAfterMidnight = new Date(2026, 6, 4, 0, 0, 1).getTime();
    const beforeMidnight = new Date(2026, 6, 3, 23, 59, 0).getTime();
    expect(shouldNotifyStart(task, justAfterMidnight)).toBe(true);
    expect(shouldNotifyStart(task, beforeMidnight)).toBe(false);
  });

  it("returns false when already notified", () => {
    const task = withOverrides({
      startDate: "2026-07-04",
      startTime: "09:00",
      notifiedStart: true,
    });
    const now = new Date(2026, 6, 4, 10, 0, 0).getTime();
    expect(shouldNotifyStart(task, now)).toBe(false);
  });

  it("returns false for completed, deleted, no-startDate, or recurring tasks", () => {
    const now = Date.now();
    expect(shouldNotifyStart(withOverrides({ startDate: null }), now)).toBe(false);
    expect(
      shouldNotifyStart(withOverrides({ startDate: "2020-01-01", completed: true }), now),
    ).toBe(false);
    expect(
      shouldNotifyStart(withOverrides({ startDate: "2020-01-01", deletedAt: 1 }), now),
    ).toBe(false);
    expect(
      shouldNotifyStart(
        withOverrides({ startDate: "2020-01-01", recurrence: { type: "daily" } }),
        now,
      ),
    ).toBe(false);
  });
});

describe("shouldNotifyEndSoon", () => {
  it("returns true within 24 hours of the deadline", () => {
    const task = withOverrides({ endDate: "2026-07-05", endTime: "09:00" });
    const now = new Date(2026, 6, 4, 9, 0, 0).getTime(); // exactly 24h before
    expect(shouldNotifyEndSoon(task, now)).toBe(true);
  });

  it("returns false more than 24 hours before the deadline", () => {
    const task = withOverrides({ endDate: "2026-07-05", endTime: "09:00" });
    const now = new Date(2026, 6, 4, 8, 59, 0).getTime();
    expect(shouldNotifyEndSoon(task, now)).toBe(false);
  });

  it("defaults end time to 23:59 when unset", () => {
    const task = withOverrides({ endDate: "2026-07-05", endTime: null });
    const within = new Date(2026, 6, 4, 23, 59, 0).getTime();
    expect(shouldNotifyEndSoon(task, within)).toBe(true);
  });

  it("still notifies after the deadline has passed (missed-window catch-up)", () => {
    const task = withOverrides({ endDate: "2026-07-05", endTime: "09:00" });
    const now = new Date(2026, 6, 5, 10, 0, 0).getTime();
    expect(shouldNotifyEndSoon(task, now)).toBe(true);
  });

  it("returns false when already notified", () => {
    const task = withOverrides({
      endDate: "2026-07-05",
      endTime: "09:00",
      notifiedEndSoon: true,
    });
    const now = new Date(2026, 6, 5, 8, 0, 0).getTime();
    expect(shouldNotifyEndSoon(task, now)).toBe(false);
  });

  it("returns false for completed, deleted, no-endDate, or recurring tasks", () => {
    const now = Date.now();
    expect(shouldNotifyEndSoon(withOverrides({ endDate: null }), now)).toBe(false);
    expect(
      shouldNotifyEndSoon(withOverrides({ endDate: "2020-01-01", completed: true }), now),
    ).toBe(false);
    expect(
      shouldNotifyEndSoon(withOverrides({ endDate: "2020-01-01", deletedAt: 1 }), now),
    ).toBe(false);
    expect(
      shouldNotifyEndSoon(
        withOverrides({ endDate: "2099-01-01", recurrence: { type: "daily" } }),
        now,
      ),
    ).toBe(false);
  });
});

describe("resetNotificationFlagsOnEdit", () => {
  const base = {
    startDate: "2026-07-04",
    startTime: "09:00",
    endDate: "2026-07-05",
    endTime: "18:00",
  };

  it("resets only notifiedStart when startDate changes", () => {
    const task = withOverrides({ ...base, notifiedStart: true, notifiedEndSoon: true });
    const result = resetNotificationFlagsOnEdit(task, { ...base, startDate: "2026-07-06" });
    expect(result).toEqual({ notifiedStart: false, notifiedEndSoon: true });
  });

  it("resets only notifiedEndSoon when endTime changes", () => {
    const task = withOverrides({ ...base, notifiedStart: true, notifiedEndSoon: true });
    const result = resetNotificationFlagsOnEdit(task, { ...base, endTime: "20:00" });
    expect(result).toEqual({ notifiedStart: true, notifiedEndSoon: false });
  });

  it("keeps both flags when nothing changes", () => {
    const task = withOverrides({ ...base, notifiedStart: true, notifiedEndSoon: true });
    const result = resetNotificationFlagsOnEdit(task, { ...base });
    expect(result).toEqual({ notifiedStart: true, notifiedEndSoon: true });
  });

  it("resets when a date/time goes from null to a value", () => {
    const task = withOverrides({
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
      notifiedStart: true,
      notifiedEndSoon: true,
    });
    const result = resetNotificationFlagsOnEdit(task, base);
    expect(result).toEqual({ notifiedStart: false, notifiedEndSoon: false });
  });

  it("resets when a date/time goes from a value to null", () => {
    const task = withOverrides({ ...base, notifiedStart: true, notifiedEndSoon: true });
    const result = resetNotificationFlagsOnEdit(task, {
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
    });
    expect(result).toEqual({ notifiedStart: false, notifiedEndSoon: false });
  });

  it("treats undefined legacy flags as false when unchanged", () => {
    const task = withOverrides({ ...base });
    // notifiedStart/notifiedEndSoon が未定義の旧データを模す
    delete (task as Partial<Task>).notifiedStart;
    delete (task as Partial<Task>).notifiedEndSoon;
    const result = resetNotificationFlagsOnEdit(task, { ...base });
    expect(result).toEqual({ notifiedStart: false, notifiedEndSoon: false });
  });
});
