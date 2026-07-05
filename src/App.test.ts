import { render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";
import { completions } from "./lib/stores/completions";
import { tasks } from "./lib/stores/tasks";
import { todayStr } from "./lib/logic/dates";
import type { Task } from "./lib/types";

describe("App", () => {
  it("renders the app name", () => {
    render(App);
    expect(screen.getByRole("heading", { name: "MONOLYSTAR" })).toBeInTheDocument();
  });
});

describe("App - 日付変更時の自動切り替え", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("開いたまま日付が変わったら、リロードなしで定期タスクの完了扱いが翌日分に切り替わる", async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0));

    const dailyTask: Task = {
      id: "t1",
      title: "毎日タスク",
      detail: "",
      priority: "should",
      category: "",
      startDate: null,
      startTime: null,
      endDate: null,
      endTime: null,
      recurrence: { type: "daily" },
      completed: false,
      completedAt: null,
      marker: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      notifiedStart: false,
      notifiedEndSoon: false,
    };
    tasks.set([dailyTask]);
    completions.set({ [`t1__${todayStr()}`]: { at: Date.now() } });

    render(App);
    await screen.findByRole("tab", { name: /定期タスク/ }).then((tab) => tab.click());

    expect(screen.getByText("今日完了")).toBeInTheDocument();

    // リロードせずに日付だけが翌日に変わる（アプリを開いたまま日をまたいだ状況を再現）。
    vi.setSystemTime(new Date(2026, 0, 16, 0, 5, 0));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(screen.queryByText("今日完了")).not.toBeInTheDocument();
  });
});
