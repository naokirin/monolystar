import { get } from "svelte/store";
import { beforeEach, describe, expect, it } from "vitest";
import { persisted } from "./persist";

describe("persisted", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to defaultValue when key is absent", () => {
    const store = persisted("test-key", { count: 0 });
    expect(get(store)).toEqual({ count: 0 });
  });

  it("reads existing value from localStorage", () => {
    localStorage.setItem("test-key", JSON.stringify({ count: 5 }));
    const store = persisted("test-key", { count: 0 });
    expect(get(store)).toEqual({ count: 5 });
  });

  it("falls back to defaultValue when JSON is invalid", () => {
    localStorage.setItem("test-key", "{not valid json");
    const store = persisted("test-key", { count: 0 });
    expect(get(store)).toEqual({ count: 0 });
  });

  it("writes updates back to localStorage", () => {
    const store = persisted("test-key", { count: 0 });
    store.set({ count: 42 });
    expect(JSON.parse(localStorage.getItem("test-key")!)).toEqual({ count: 42 });
  });
});
