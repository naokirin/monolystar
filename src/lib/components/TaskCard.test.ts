import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskCard from "./TaskCard.svelte";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: "t1",
    title: "既存タスク",
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
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
    ...overrides,
  };
}

/**
 * jsdomにはmatchMediaが実装されていないため、TaskCard.svelteの
 * prefersReducedMotion()は既定でfalse（視差効果を減らす設定なし）を返す。
 * そのため完了トグルは常にsetTimeoutを伴う演出経路を通る。
 * ここでは`matches: true`を返すよう明示的にモックし、演出をスキップして
 * onToggleが同期的に呼ばれるようにする。
 */
function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
}

describe("TaskCard", () => {
  afterEach(() => {
    // @ts-expect-error テスト間の汚染を防ぐため、モックしたプロパティを削除する。
    delete window.matchMedia;
  });

  it("タイトルボタンをクリックするとonOpenがそのタスクで呼ばれる", async () => {
    const onOpen = vi.fn();
    const task = makeTask();
    render(TaskCard, {
      task,
      completed: false,
      onToggle: vi.fn(),
      onToggleMarker: vi.fn(),
      onOpen,
    });

    await fireEvent.click(screen.getByRole("button", { name: "既存タスク" }));

    expect(onOpen).toHaveBeenCalledWith(task);
  });

  it("完了トグルボタンをクリックするとonToggleがtaskIdで呼ばれる", async () => {
    mockReducedMotion(true);
    const onToggle = vi.fn();
    const task = makeTask();
    render(TaskCard, {
      task,
      completed: false,
      onToggle,
      onToggleMarker: vi.fn(),
      onOpen: vi.fn(),
    });

    await fireEvent.click(screen.getByRole("button", { name: "「既存タスク」を完了にする" }));

    expect(onToggle).toHaveBeenCalledWith("t1");
  });

  it("目印ボタンのaria-pressedがmarker値を反映する（marker: false）", () => {
    render(TaskCard, {
      task: makeTask({ marker: false }),
      completed: false,
      onToggle: vi.fn(),
      onToggleMarker: vi.fn(),
      onOpen: vi.fn(),
    });

    const markerButton = screen.getByRole("button", { name: "「既存タスク」に目印を付ける" });
    expect(markerButton).toHaveAttribute("aria-pressed", "false");
  });

  it("目印ボタンのaria-pressedがmarker値を反映する（marker: true）", () => {
    render(TaskCard, {
      task: makeTask({ marker: true }),
      completed: false,
      onToggle: vi.fn(),
      onToggleMarker: vi.fn(),
      onOpen: vi.fn(),
    });

    const markerButton = screen.getByRole("button", { name: "「既存タスク」の目印を外す" });
    expect(markerButton).toHaveAttribute("aria-pressed", "true");
  });

  describe("締切の警告色表示", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("締切24時間以内のタスクは日時バッジにbadge-warningが付く", () => {
      vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0));
      const task = makeTask({ endDate: "2026-01-15", endTime: "20:00" });
      render(TaskCard, {
        task,
        completed: false,
        onToggle: vi.fn(),
        onToggleMarker: vi.fn(),
        onOpen: vi.fn(),
      });

      expect(screen.getByText("〜 2026-01-15 20:00")).toHaveClass("badge-warning");
    });

    it("締切超過のタスクは日時バッジにbadge-warningが付く", () => {
      vi.setSystemTime(new Date(2026, 0, 16, 10, 0, 0));
      const task = makeTask({ endDate: "2026-01-15", endTime: "20:00" });
      render(TaskCard, {
        task,
        completed: false,
        onToggle: vi.fn(),
        onToggleMarker: vi.fn(),
        onOpen: vi.fn(),
      });

      expect(screen.getByText("〜 2026-01-15 20:00")).toHaveClass("badge-warning");
    });

    it("締切がまだ遠いタスクは日時バッジにbadge-warningが付かない", () => {
      vi.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));
      const task = makeTask({ endDate: "2026-01-15", endTime: "20:00" });
      render(TaskCard, {
        task,
        completed: false,
        onToggle: vi.fn(),
        onToggleMarker: vi.fn(),
        onOpen: vi.fn(),
      });

      expect(screen.getByText("〜 2026-01-15 20:00")).not.toHaveClass("badge-warning");
    });
  });
});
