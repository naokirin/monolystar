import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Toast, { type ToastMessage } from "./Toast.svelte";

describe("Toast", () => {
  it("アクション付きトーストのボタンを押すとonActionとonDismissが呼ばれる", async () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const toasts: ToastMessage[] = [
      {
        id: 1,
        text: "タスクを削除しました",
        action: { label: "元に戻す", onAction },
        durationMs: 6000,
      },
    ];

    render(Toast, { toasts, onDismiss });

    await fireEvent.click(screen.getByRole("button", { name: "元に戻す" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it("アクションなしのトーストにはボタンが表示されない", () => {
    const toasts: ToastMessage[] = [{ id: 2, text: "タスクを追加しました" }];

    render(Toast, { toasts });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("タスクを追加しました")).toBeInTheDocument();
  });
});
