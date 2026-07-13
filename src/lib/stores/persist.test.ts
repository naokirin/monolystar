import { get } from "svelte/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistError, persisted } from "./persist";

interface Counter {
  count: number;
}

function isCounter(value: unknown): value is Counter {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).count === "number"
  );
}

describe("persisted", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to defaultValue when key is absent", () => {
    const store = persisted("test-key", { count: 0 }, isCounter);
    expect(get(store)).toEqual({ count: 0 });
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("test-key", JSON.stringify({ count: 5 }));
    const store = persisted("test-key", { count: 0 }, isCounter);
    expect(get(store)).toEqual({ count: 5 });
  });

  it("falls back to defaultValue and quarantines when JSON is invalid", () => {
    const raw = "{not valid json";
    localStorage.setItem("test-key", raw);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = persisted("test-key", { count: 0 }, isCounter);

    expect(get(store)).toEqual({ count: 0 });
    // 破損データは復旧不能なまま消えず、.corrupt へ退避されている。
    expect(localStorage.getItem("test-key.corrupt")).toBe(raw);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("falls back to defaultValue and quarantines when shape is invalid", () => {
    // 形状不正（count が数値でない）を検知して退避する。
    const raw = JSON.stringify({ count: "nope" });
    localStorage.setItem("test-key", raw);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = persisted("test-key", { count: 0 }, isCounter);

    expect(get(store)).toEqual({ count: 0 });
    expect(localStorage.getItem("test-key.corrupt")).toBe(raw);
    warn.mockRestore();
  });

  it("does not overwrite the original key with defaultValue on corrupt read", () => {
    const raw = "{broken";
    localStorage.setItem("test-key", raw);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // 生成直後に subscribe が defaultValue を書き戻すが、退避が先に済んでいるため
    // 破損データは失われない。
    persisted("test-key", { count: 0 }, isCounter);

    expect(localStorage.getItem("test-key.corrupt")).toBe(raw);
    warn.mockRestore();
  });

  it("writes updates back to localStorage", () => {
    const store = persisted("test-key", { count: 0 }, isCounter);
    store.set({ count: 42 });
    expect(JSON.parse(localStorage.getItem("test-key")!)).toEqual({ count: 42 });
  });
});

describe("persisted write failures", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // persistError のスロットル状態は次テストへ引き継がれるが、fake timer で
    // 各テストの基準時刻が十分離れるため干渉しない。
    vi.setSystemTime(new Date("2026-07-13T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("records persistError when setItem throws", () => {
    const store = persisted("fail-key", { count: 0 }, isCounter);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    store.set({ count: 1 });

    expect(get(persistError)).not.toBeNull();
    expect(get(persistError)?.key).toBe("fail-key");
    spy.mockRestore();
  });

  it("throttles repeated failures within 60s", () => {
    const store = persisted("fail-key-2", { count: 0 }, isCounter);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    // 十分に時間を進めてから最初の失敗を起こし、前テストのスロットルをリセットする。
    vi.advanceTimersByTime(120_000);
    store.set({ count: 1 });
    const first = get(persistError);
    expect(first).not.toBeNull();

    // 60秒以内の連続失敗では再セットしない（同一参照のまま）。
    vi.advanceTimersByTime(30_000);
    store.set({ count: 2 });
    expect(get(persistError)).toBe(first);

    // 60秒を超えると再び通知される。
    vi.advanceTimersByTime(31_000);
    store.set({ count: 3 });
    expect(get(persistError)).not.toBe(first);
    spy.mockRestore();
  });
});
