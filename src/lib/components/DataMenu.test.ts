import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import DataMenu from "./DataMenu.svelte";
import { todayStr } from "../logic/dates";
import type { Completions, Prefs, SyncFile, Task } from "../types";

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

function makePrefs(overrides: Partial<Prefs> = {}): Prefs {
  return {
    notif: false,
    farDeadlineThresholdDays: 7,
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeSyncFile(overrides: Partial<SyncFile> = {}): SyncFile {
  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    deviceId: "device-remote",
    tasks: [makeTask({ id: "remote-1", title: "読み込むタスク" })],
    completions: {},
    prefs: makePrefs(),
    ...overrides,
  };
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

interface DataMenuTestProps {
  deviceId: string;
  tasks: Task[];
  completions: Completions;
  prefs: Prefs;
  isLocalEmpty: boolean;
  today: string;
  onImport: (choice: "remote" | "local" | "merge", file: SyncFile) => void;
  onReset: () => void;
  onPurgeDone: (thresholdDays: number) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

function renderDataMenu(overrides: Partial<DataMenuTestProps> = {}) {
  const props: DataMenuTestProps = {
    deviceId: "device-local",
    tasks: [] as Task[],
    completions: {} as Completions,
    prefs: makePrefs(),
    isLocalEmpty: false,
    today: todayStr(),
    onImport: vi.fn(),
    onReset: vi.fn(),
    onPurgeDone: vi.fn(),
    onError: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(DataMenu, props), props };
}

describe("DataMenu - ファイル読み込み（既存データあり）", () => {
  it("有効なJSONを読み込むと3択が表示され、「マージ（推奨）」でonImportが呼ばれる", async () => {
    const syncFile = makeSyncFile();
    const onImport = vi.fn();
    const { container } = renderDataMenu({
      tasks: [makeTask()],
      isLocalEmpty: false,
      onImport,
    });

    const file = new File([JSON.stringify(syncFile)], "backup.json", {
      type: "application/json",
    });
    await fireEvent.change(getFileInput(container), { target: { files: [file] } });

    expect(await screen.findByText("既存のデータがあります。読み込んだデータをどう反映しますか？")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "マージ（推奨）" }));

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledWith("merge", expect.objectContaining({ deviceId: "device-remote" }));
  });

  it("不正なJSONを読み込むとonErrorが呼ばれる", async () => {
    const onError = vi.fn();
    const onImport = vi.fn();
    const { container } = renderDataMenu({
      tasks: [makeTask()],
      isLocalEmpty: false,
      onImport,
      onError,
    });

    const file = new File(["{ not valid json"], "broken.json", {
      type: "application/json",
    });
    await fireEvent.change(getFileInput(container), { target: { files: [file] } });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe("DataMenu - 古い完了タスクの一括削除", () => {
  it("削除対象が0件のときは実行ボタンがdisabledになる", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const recentlyDoneTask = makeTask({
      completed: true,
      completedAt: Date.now() - oneDayMs, // 1日前完了。既定90日しきい値より遥かに新しい。
    });

    renderDataMenu({ tasks: [recentlyDoneTask] });

    expect(screen.getByText("削除対象: 0件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "古い完了タスクを削除" })).toBeDisabled();
  });

  it("削除対象がある場合は件数がプレビューされ、実行確認後にonPurgeDoneが日数で呼ばれる", async () => {
    const oldDoneTask = makeTask({
      id: "old-done",
      completed: true,
      completedAt: Date.now() - 200 * 24 * 60 * 60 * 1000, // 200日前完了。既定90日しきい値を超える。
    });
    const onPurgeDone = vi.fn();

    renderDataMenu({ tasks: [oldDoneTask], onPurgeDone });

    expect(screen.getByText("削除対象: 1件")).toBeInTheDocument();
    const purgeButton = screen.getByRole("button", { name: "古い完了タスクを削除" });
    expect(purgeButton).not.toBeDisabled();

    await fireEvent.click(purgeButton);
    expect(screen.getByRole("alert")).toHaveTextContent("完了から90日以上経過したタスク・完了記録1件を削除します");

    await fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(onPurgeDone).toHaveBeenCalledWith(90);
  });
});
