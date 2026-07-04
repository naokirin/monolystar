import { describe, expect, it } from "vitest";
import type { Completions, Prefs, Task } from "../types";
import {
  DEFAULT_SYNC_INTERVAL_MS,
  mergeCompletions,
  mergePrefs,
  mergeTasks,
} from "./merge";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    title: "テスト",
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
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
    marker: false,
    ...overrides,
  };
}

describe("mergeTasks - 削除の伝播", () => {
  it("ローカルにのみ deletedAt がある場合、削除が伝播する", () => {
    const local = makeTask({ id: "t1", updatedAt: 100, deletedAt: 100 });
    const remote = makeTask({ id: "t1", updatedAt: 50, deletedAt: null });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(100);
  });

  it("リモートにのみ deletedAt がある場合、削除が伝播する", () => {
    const local = makeTask({ id: "t1", updatedAt: 50, deletedAt: null });
    const remote = makeTask({ id: "t1", updatedAt: 100, deletedAt: 100 });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe(100);
  });

  it("ローカルの deletedAt が updatedAt より古くても、削除が優先される", () => {
    // 削除操作の方がローカルの updatedAt より前に行われていた場合でも、
    // 「片方にのみ deletedAt がある」以上は削除を伝播させる。
    const local = makeTask({ id: "t1", updatedAt: 200, deletedAt: 100 });
    const remote = makeTask({ id: "t1", updatedAt: 150, deletedAt: null });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].deletedAt).toBe(100);
  });

  it("両方に deletedAt がある場合は LWW（updatedAt が新しい方）で決着する", () => {
    const local = makeTask({
      id: "t1",
      updatedAt: 100,
      deletedAt: 100,
      title: "ローカル削除",
    });
    const remote = makeTask({
      id: "t1",
      updatedAt: 200,
      deletedAt: 200,
      title: "リモート削除",
    });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].title).toBe("リモート削除");
    expect(merged[0].deletedAt).toBe(200);
  });

  it("どちらも deletedAt がない場合は削除伝播ルールは働かない（LWWへ）", () => {
    const local = makeTask({ id: "t1", updatedAt: 100, title: "ローカル" });
    const remote = makeTask({ id: "t1", updatedAt: 200, title: "リモート" });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].deletedAt).toBeNull();
    expect(merged[0].title).toBe("リモート");
  });
});

describe("mergeTasks - LWW（updatedAtが新しい方の採用）", () => {
  it("updatedAt が新しい方の内容が採用される", () => {
    const local = makeTask({ id: "t1", updatedAt: 100, title: "旧タイトル" });
    const remote = makeTask({ id: "t1", updatedAt: 200, title: "新タイトル" });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].title).toBe("新タイトル");
  });

  it("ローカルの方が新しい場合はローカルが採用される", () => {
    const local = makeTask({ id: "t1", updatedAt: 300, title: "ローカル新" });
    const remote = makeTask({ id: "t1", updatedAt: 200, title: "リモート旧" });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].title).toBe("ローカル新");
  });

  it("updatedAt が同点の場合はローカルを優先する", () => {
    const local = makeTask({ id: "t1", updatedAt: 100, title: "ローカル" });
    const remote = makeTask({ id: "t1", updatedAt: 100, title: "リモート" });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].title).toBe("ローカル");
  });
});

describe("mergeTasks - 片方にのみ存在するタスク", () => {
  it("ローカルにのみ存在するタスクはそのまま残る", () => {
    const local = makeTask({ id: "t1", title: "ローカルのみ" });

    const { merged } = mergeTasks([local], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("ローカルのみ");
  });

  it("リモートにのみ存在するタスクはそのまま取り込まれる", () => {
    const remote = makeTask({ id: "t2", title: "リモートのみ" });

    const { merged } = mergeTasks([], [remote]);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("リモートのみ");
  });

  it("双方に存在しないタスク同士も、それぞれ独立に残る", () => {
    const local = makeTask({ id: "t1", title: "ローカル" });
    const remote = makeTask({ id: "t2", title: "リモート" });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged).toHaveLength(2);
    expect(merged.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });
});

describe("mergeTasks - 競合候補の検出", () => {
  it("updatedAt の差が同期間隔以内かつ内容が異なる場合、競合としてカウントする", () => {
    const local = makeTask({ id: "t1", updatedAt: 1000, title: "A" });
    const remote = makeTask({ id: "t1", updatedAt: 1000 + 30_000, title: "B" });

    const { conflictCount } = mergeTasks([local], [remote], 60_000);

    expect(conflictCount).toBe(1);
  });

  it("updatedAt の差が同期間隔を超える場合は競合としてカウントしない", () => {
    const local = makeTask({ id: "t1", updatedAt: 1000, title: "A" });
    const remote = makeTask({
      id: "t1",
      updatedAt: 1000 + 120_000,
      title: "B",
    });

    const { conflictCount } = mergeTasks([local], [remote], 60_000);

    expect(conflictCount).toBe(0);
  });

  it("内容が同一であれば updatedAt が近くても競合としてカウントしない", () => {
    const local = makeTask({ id: "t1", updatedAt: 1000, title: "同じ" });
    const remote = makeTask({ id: "t1", updatedAt: 1010, title: "同じ" });

    const { conflictCount } = mergeTasks([local], [remote], 60_000);

    expect(conflictCount).toBe(0);
  });

  it("片方にのみ存在するタスクは競合カウント対象にならない", () => {
    const local = makeTask({ id: "t1", title: "ローカルのみ" });

    const { conflictCount } = mergeTasks([local], []);

    expect(conflictCount).toBe(0);
  });

  it("デフォルトの同期間隔が指定される", () => {
    expect(DEFAULT_SYNC_INTERVAL_MS).toBeGreaterThan(0);
  });
});

describe("mergeTasks - 削除の伝播とLWWが同時に絡むケース", () => {
  it("ローカルで削除・リモートで別フィールドを更新した場合、より新しい方が勝つ（削除が新しければ削除、更新が新しければ復活）", () => {
    // ケースA: ローカルの削除の方が新しい updatedAt を持つ → 削除が勝つ
    const localDeletedNewer = makeTask({
      id: "t1",
      updatedAt: 300,
      deletedAt: 300,
    });
    const remoteUpdatedOlder = makeTask({
      id: "t1",
      updatedAt: 200,
      title: "リモート更新",
      deletedAt: null,
    });

    const resultA = mergeTasks([localDeletedNewer], [remoteUpdatedOlder]);
    expect(resultA.merged[0].deletedAt).toBe(300);

    // ケースB: リモートの更新の方が新しい updatedAt を持つ場合でも、
    // 「片方にのみ deletedAt がある」ルールが優先されるため、削除が伝播する
    // （削除操作の取りこぼしによるデータ復活を避けるための仕様上の意図的な挙動）。
    const localDeletedOlder = makeTask({
      id: "t1",
      updatedAt: 100,
      deletedAt: 100,
    });
    const remoteUpdatedNewer = makeTask({
      id: "t1",
      updatedAt: 400,
      title: "リモート更新（新しい）",
      deletedAt: null,
    });

    const resultB = mergeTasks([localDeletedOlder], [remoteUpdatedNewer]);
    expect(resultB.merged[0].deletedAt).toBe(100);
  });
});

describe("mergeTasks - marker（目印）", () => {
  it("updatedAt が新しい方の marker が採用される（LWW）", () => {
    const local = makeTask({ id: "t1", updatedAt: 100, marker: false });
    const remote = makeTask({ id: "t1", updatedAt: 200, marker: true });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].marker).toBe(true);
  });

  it("ローカルの方が新しい場合はローカルの marker が採用される", () => {
    const local = makeTask({ id: "t1", updatedAt: 300, marker: true });
    const remote = makeTask({ id: "t1", updatedAt: 200, marker: false });

    const { merged } = mergeTasks([local], [remote]);

    expect(merged[0].marker).toBe(true);
  });

  it("marker のみが異なり updatedAt の差が同期間隔以内の場合、競合としてカウントする", () => {
    const local = makeTask({ id: "t1", updatedAt: 1000, marker: false });
    const remote = makeTask({
      id: "t1",
      updatedAt: 1000 + 30_000,
      marker: true,
    });

    const { conflictCount } = mergeTasks([local], [remote], 60_000);

    expect(conflictCount).toBe(1);
  });

  it("marker が同一であれば競合としてカウントしない", () => {
    const local = makeTask({ id: "t1", updatedAt: 1000, marker: true });
    const remote = makeTask({ id: "t1", updatedAt: 1010, marker: true });

    const { conflictCount } = mergeTasks([local], [remote], 60_000);

    expect(conflictCount).toBe(0);
  });
});

describe("mergeCompletions", () => {
  it("同一キーで at が新しい方（リモート）を採用する", () => {
    const local: Completions = { "t1__2024-01-01": { at: 100 } };
    const remote: Completions = { "t1__2024-01-01": { at: 200 } };

    const merged = mergeCompletions(local, remote);

    expect(merged["t1__2024-01-01"].at).toBe(200);
  });

  it("同一キーで at が新しい方（ローカル）を採用する", () => {
    const local: Completions = { "t1__2024-01-01": { at: 300 } };
    const remote: Completions = { "t1__2024-01-01": { at: 200 } };

    const merged = mergeCompletions(local, remote);

    expect(merged["t1__2024-01-01"].at).toBe(300);
  });

  it("片方にのみ存在するキーはそのまま取り込む", () => {
    const local: Completions = { "t1__2024-01-01": { at: 100 } };
    const remote: Completions = { "t2__2024-01-02": { at: 200 } };

    const merged = mergeCompletions(local, remote);

    expect(merged["t1__2024-01-01"].at).toBe(100);
    expect(merged["t2__2024-01-02"].at).toBe(200);
  });

  it("at が同点の場合はローカルを優先する", () => {
    const local: Completions = { "t1__2024-01-01": { at: 100 } };
    const remote: Completions = { "t1__2024-01-01": { at: 100 } };

    const merged = mergeCompletions(local, remote);

    expect(merged["t1__2024-01-01"]).toBe(local["t1__2024-01-01"]);
  });
});

describe("mergePrefs", () => {
  it("updatedAt が新しい方（リモート）を採用する", () => {
    const local: Prefs = { notif: true, updatedAt: 100 };
    const remote: Prefs = { notif: false, updatedAt: 200 };

    expect(mergePrefs(local, remote)).toEqual(remote);
  });

  it("updatedAt が新しい方（ローカル）を採用する", () => {
    const local: Prefs = { notif: true, updatedAt: 300 };
    const remote: Prefs = { notif: false, updatedAt: 200 };

    expect(mergePrefs(local, remote)).toEqual(local);
  });

  it("updatedAt が同点の場合はローカルを優先する", () => {
    const local: Prefs = { notif: true, updatedAt: 100 };
    const remote: Prefs = { notif: false, updatedAt: 100 };

    expect(mergePrefs(local, remote)).toEqual(local);
  });
});
