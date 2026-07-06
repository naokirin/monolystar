import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskFormModal from "./TaskFormModal.svelte";
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

describe("TaskFormModal - 自動保存（編集モード）", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("タイトル変更から500ms後にonSaveが新しい値で呼ばれる", async () => {
    const onSave = vi.fn();
    render(TaskFormModal, {
      task: makeTask(),
      existingCategories: [],
      onSave,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    const titleInput = screen.getByLabelText("タイトル");
    await fireEvent.input(titleInput, { target: { value: "更新後タイトル" } });

    expect(onSave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("t1", expect.objectContaining({ title: "更新後タイトル" }));
  });

  it("500ms以内の連続変更はデバウンスされ、最後の値で1回だけ呼ばれる", async () => {
    const onSave = vi.fn();
    render(TaskFormModal, {
      task: makeTask(),
      existingCategories: [],
      onSave,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    const titleInput = screen.getByLabelText("タイトル");
    await fireEvent.input(titleInput, { target: { value: "途中1" } });
    await vi.advanceTimersByTimeAsync(200);
    await fireEvent.input(titleInput, { target: { value: "途中2" } });
    await vi.advanceTimersByTimeAsync(200);
    await fireEvent.input(titleInput, { target: { value: "最終" } });
    await vi.advanceTimersByTimeAsync(500);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("t1", expect.objectContaining({ title: "最終" }));
  });

  it("タイトルを空にすると自動保存されずエラーが表示される", async () => {
    const onSave = vi.fn();
    render(TaskFormModal, {
      task: makeTask(),
      existingCategories: [],
      onSave,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    const titleInput = screen.getByLabelText("タイトル");
    await fireEvent.input(titleInput, { target: { value: "  " } });
    await vi.advanceTimersByTimeAsync(500);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("タイトルを入力してください");
  });

  it("デバウンス待ち中に閉じると、閉じる前に最後の変更が保存される", async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(TaskFormModal, {
      task: makeTask(),
      existingCategories: [],
      onSave,
      onDelete: vi.fn(),
      onClose,
    });

    const titleInput = screen.getByLabelText("タイトル");
    await fireEvent.input(titleInput, { target: { value: "閉じる直前の変更" } });

    // デバウンス満了前（500ms未満）に閉じる操作をする。
    await fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(onSave).toHaveBeenCalledWith("t1", expect.objectContaining({ title: "閉じる直前の変更" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TaskFormModal - 新規追加モードは自動保存しない", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("入力を変更しても自動では保存されず、「追加」ボタン押下でのみonSaveが呼ばれる", async () => {
    const onSave = vi.fn();
    render(TaskFormModal, {
      task: null,
      initialTitle: "",
      existingCategories: [],
      onSave,
      onDelete: vi.fn(),
      onClose: vi.fn(),
    });

    const titleInput = screen.getByLabelText("タイトル");
    await fireEvent.input(titleInput, { target: { value: "新規タスク" } });
    await vi.advanceTimersByTimeAsync(2000);

    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.click(screen.getByRole("button", { name: "追加" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(null, expect.objectContaining({ title: "新規タスク" }));
  });
});
