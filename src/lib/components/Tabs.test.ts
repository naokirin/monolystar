import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import Tabs, { type TabDef } from "./Tabs.svelte";

const tabs: TabDef[] = [
  { id: "today", label: "今日", count: 1 },
  { id: "all", label: "すべて", count: 2 },
  { id: "recurring", label: "定期タスク", count: 3 },
];

describe("Tabs", () => {
  it("アクティブなタブのみtabindex=0で、他は-1になる", () => {
    render(Tabs, { tabs, activeTab: "all", onSelect: vi.fn() });

    expect(screen.getByRole("tab", { name: /今日/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /すべて/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /定期タスク/ })).toHaveAttribute("tabindex", "-1");
  });

  it("ArrowRightで次のタブがonSelectされる", async () => {
    const onSelect = vi.fn();
    render(Tabs, { tabs, activeTab: "today", onSelect });

    await fireEvent.keyDown(screen.getByRole("tab", { name: /今日/ }), { key: "ArrowRight" });

    expect(onSelect).toHaveBeenCalledWith("all");
  });

  it("末尾タブでArrowRightを押すと先頭タブにループする", async () => {
    const onSelect = vi.fn();
    render(Tabs, { tabs, activeTab: "recurring", onSelect });

    await fireEvent.keyDown(screen.getByRole("tab", { name: /定期タスク/ }), {
      key: "ArrowRight",
    });

    expect(onSelect).toHaveBeenCalledWith("today");
  });

  it("先頭タブでArrowLeftを押すと末尾タブにループする", async () => {
    const onSelect = vi.fn();
    render(Tabs, { tabs, activeTab: "today", onSelect });

    await fireEvent.keyDown(screen.getByRole("tab", { name: /今日/ }), { key: "ArrowLeft" });

    expect(onSelect).toHaveBeenCalledWith("recurring");
  });

  it("Homeで先頭タブがonSelectされる", async () => {
    const onSelect = vi.fn();
    render(Tabs, { tabs, activeTab: "recurring", onSelect });

    await fireEvent.keyDown(screen.getByRole("tab", { name: /定期タスク/ }), { key: "Home" });

    expect(onSelect).toHaveBeenCalledWith("today");
  });

  it("Endで末尾タブがonSelectされる", async () => {
    const onSelect = vi.fn();
    render(Tabs, { tabs, activeTab: "today", onSelect });

    await fireEvent.keyDown(screen.getByRole("tab", { name: /今日/ }), { key: "End" });

    expect(onSelect).toHaveBeenCalledWith("recurring");
  });
});
