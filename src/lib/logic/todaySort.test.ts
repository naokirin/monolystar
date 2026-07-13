import { describe, expect, it } from "vitest";
import type { Completions, Task } from "../types";
import { getTodayTasks } from "./todaySort";

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
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
    marker: false,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
    ...overrides,
  };
}

const TODAY = "2024-01-10"; // 水曜日

// 既存の並び替えテストは締切バケット機能の影響を受けないよう、十分大きい閾値を使う
// （既存テストのendDateは最大でも2024-01-20＝10日先程度のため、バケット2に落ちないようにする）。
const FAR_THRESHOLD = 9999;

describe("getTodayTasks - 抽出条件（ワンショット）", () => {
  it("未完了かつ日付範囲なしのタスクは対象になる", () => {
    const task = makeTask({ id: "t1" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("完了済みタスクは除外される", () => {
    const task = makeTask({ id: "t1", completed: true });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("削除済み（deletedAt !== null）のタスクは除外される", () => {
    const task = makeTask({ id: "t1", deletedAt: 12345 });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("startDateが今日より後のタスクは除外される", () => {
    const task = makeTask({ id: "t1", startDate: "2024-01-11" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("startDateが今日以前のタスクは対象になる", () => {
    const task = makeTask({ id: "t1", startDate: "2024-01-10" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが今日より前でも未完了なら対象になる（締切超過タスクは今日タブに残る・独自解釈）", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-09" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが数日前でも未完了なら対象になる", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-01" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateがちょうど今日のタスクは対象になる", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-10" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが今日以降のタスクは対象になる", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-20" });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが未設定でも未完了なら対象になる", () => {
    const task = makeTask({ id: "t1", endDate: null });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("endDateが今日より前でも完了済み（completed: true）なら除外される（回帰確認）", () => {
    const task = makeTask({ id: "t1", endDate: "2024-01-01", completed: true });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });
});

describe("getTodayTasks - 抽出条件（定期タスク）", () => {
  it("該当曜日かつ完了記録なしなら対象になる", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [3] }, // 水曜日
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("該当曜日でも今日分の完了記録があれば除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [3] },
    });
    const completions: Completions = { "t1__2024-01-10": { at: 1 } };
    expect(getTodayTasks([task], completions, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("該当曜日でなければ除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "weekly", weekdays: [4] }, // 木曜日
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("削除済み（deletedAt !== null）の定期タスクは除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      deletedAt: 12345,
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("有効期間外（開始前）なら除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      startDate: "2024-01-11",
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("有効期間外（終了後）なら除外される", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      endDate: "2024-01-09",
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD)).toEqual([]);
  });

  it("有効期間内かつ完了記録なしのdailyタスクは対象になる", () => {
    const task = makeTask({
      id: "t1",
      recurrence: { type: "daily" },
      startDate: "2024-01-01",
      endDate: "2024-01-31",
    });
    expect(getTodayTasks([task], {}, TODAY, FAR_THRESHOLD).map((t) => t.id)).toEqual(["t1"]);
  });

  it("隔週（biweekly）: 基準週から2週間おきの該当日のみ対象になる", () => {
    const base = { id: "t1", recurrence: { type: "biweekly" as const, weekdays: [3] }, startDate: "2024-01-03" };
    // 基準週（起点そのもの）
    expect(
      getTodayTasks([makeTask(base)], {}, "2024-01-03", FAR_THRESHOLD).map(
        (t) => t.id,
      ),
    ).toEqual(["t1"]);
    // 1週間後（奇数週）は非該当
    expect(
      getTodayTasks([makeTask(base)], {}, "2024-01-10", FAR_THRESHOLD),
    ).toEqual([]);
    // 2週間後（偶数週）は該当
    expect(
      getTodayTasks([makeTask(base)], {}, "2024-01-17", FAR_THRESHOLD).map(
        (t) => t.id,
      ),
    ).toEqual(["t1"]);
  });
});

describe("getTodayTasks - 並び替え", () => {
  it("優先度が異なる場合は締切より優先度が勝つ", () => {
    // shouldだが締切が近いタスク vs mustだが締切が遠い/なしタスク
    const soon = makeTask({
      id: "should-soon",
      priority: "should",
      endDate: "2024-01-10",
      endTime: "09:00",
    });
    const mustNoDeadline = makeTask({
      id: "must-no-deadline",
      priority: "must",
    });
    expect(
      getTodayTasks([soon, mustNoDeadline], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["must-no-deadline", "should-soon"]);
  });

  it("締切未設定タスクは締切設定タスクより下位（最下位）になる", () => {
    const withDeadline = makeTask({
      id: "with-deadline",
      endDate: "2024-01-20",
      endTime: "23:59",
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([noDeadline, withDeadline], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["with-deadline", "no-deadline"]);
  });

  it("同一優先度なら締切が早い方が上位になる", () => {
    const early = makeTask({
      id: "early",
      endDate: "2024-01-10",
      endTime: "10:00",
    });
    const late = makeTask({
      id: "late",
      endDate: "2024-01-10",
      endTime: "18:00",
    });
    expect(
      getTodayTasks([late, early], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["early", "late"]);
  });

  it("優先度・締切が同条件の場合は開始日が早い方が上位になる", () => {
    const earlyStart = makeTask({
      id: "early-start",
      endDate: "2024-01-20",
      startDate: "2024-01-01",
    });
    const lateStart = makeTask({
      id: "late-start",
      endDate: "2024-01-20",
      startDate: "2024-01-05",
    });
    expect(
      getTodayTasks([lateStart, earlyStart], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["early-start", "late-start"]);
  });

  it("優先度・締切が同条件で開始日未設定の場合は開始日設定タスクより上位になる（独自解釈）", () => {
    const noStart = makeTask({ id: "no-start", endDate: "2024-01-20" });
    const withStart = makeTask({
      id: "with-start",
      endDate: "2024-01-20",
      startDate: "2024-01-05",
    });
    expect(
      getTodayTasks([withStart, noStart], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["no-start", "with-start"]);
  });

  it("すべてのタイブレーク基準が完全同点の場合は元の配列順を維持する（安定ソート）", () => {
    const a = makeTask({ id: "a", endDate: "2024-01-20" });
    const b = makeTask({ id: "b", endDate: "2024-01-20" });
    const c = makeTask({ id: "c", endDate: "2024-01-20" });
    expect(
      getTodayTasks([a, b, c], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("目印ONのshouldタスクは目印OFFのmustタスクより上位になる", () => {
    const markedShould = makeTask({
      id: "marked-should",
      priority: "should",
      marker: true,
    });
    const unmarkedMust = makeTask({
      id: "unmarked-must",
      priority: "must",
      marker: false,
    });
    expect(
      getTodayTasks([unmarkedMust, markedShould], {}, TODAY, FAR_THRESHOLD).map(
        (t) => t.id,
      ),
    ).toEqual(["marked-should", "unmarked-must"]);
  });

  it("目印の有無以外が同条件の場合は目印ONが優先度→締切→開始日より先に効く", () => {
    const markedLowPriorityLateDeadline = makeTask({
      id: "marked-low",
      priority: "should",
      endDate: "2024-01-20",
      endTime: "23:59",
      marker: true,
    });
    const unmarkedHighPriorityEarlyDeadline = makeTask({
      id: "unmarked-high",
      priority: "must",
      endDate: "2024-01-10",
      endTime: "09:00",
      marker: false,
    });
    expect(
      getTodayTasks(
        [unmarkedHighPriorityEarlyDeadline, markedLowPriorityLateDeadline],
        {},
        TODAY,
        FAR_THRESHOLD,
      ).map((t) => t.id),
    ).toEqual(["marked-low", "unmarked-high"]);
  });

  it("目印が同じ場合は通常通り優先度→締切→開始日でタイブレークされる", () => {
    const markedMust = makeTask({
      id: "marked-must",
      priority: "must",
      marker: true,
    });
    const markedShould = makeTask({
      id: "marked-should",
      priority: "should",
      marker: true,
    });
    expect(
      getTodayTasks([markedShould, markedMust], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["marked-must", "marked-should"]);
  });

  it("締切超過（過去日時）タスクは締切未到来タスクより締切近さの上位に並ぶ", () => {
    const overdue = makeTask({
      id: "overdue",
      endDate: "2024-01-01",
      endTime: "10:00",
    });
    const upcoming = makeTask({
      id: "upcoming",
      endDate: "2024-01-20",
      endTime: "10:00",
    });
    expect(
      getTodayTasks([upcoming, overdue], {}, TODAY, FAR_THRESHOLD).map((t) => t.id),
    ).toEqual(["overdue", "upcoming"]);
  });

  it("ワンショットと定期タスクが混在しても優先度・締切ルールで統一的に並ぶ", () => {
    const oneShotMust = makeTask({
      id: "oneshot-must",
      priority: "must",
      endDate: "2024-01-15",
    });
    const recurringMustSoonDeadline = makeTask({
      id: "recurring-must",
      priority: "must",
      recurrence: { type: "daily" },
      endDate: "2024-01-10",
      endTime: "08:00",
    });
    const oneShotShould = makeTask({
      id: "oneshot-should",
      priority: "should",
    });
    expect(
      getTodayTasks(
        [oneShotShould, oneShotMust, recurringMustSoonDeadline],
        {},
        TODAY,
        FAR_THRESHOLD,
      ).map((t) => t.id),
    ).toEqual(["recurring-must", "oneshot-must", "oneshot-should"]);
  });
});

describe("getTodayTasks - 締切が遠いタスクの並び替え（farDeadlineThresholdDays）", () => {
  it("閾値以上先（10日後、閾値7日）の締切ありタスクは締切未設定タスクより下位になる", () => {
    const farDeadline = makeTask({
      id: "far",
      endDate: "2024-01-20", // TODAYから10日後
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([farDeadline, noDeadline], {}, TODAY, 7).map(
        (t) => t.id,
      ),
    ).toEqual(["no-deadline", "far"]);
  });

  it("閾値未満（3日後、閾値7日）の締切ありタスクは締切未設定タスクより上位のままになる", () => {
    const nearDeadline = makeTask({
      id: "near",
      endDate: "2024-01-13", // TODAYから3日後
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([noDeadline, nearDeadline], {}, TODAY, 7).map(
        (t) => t.id,
      ),
    ).toEqual(["near", "no-deadline"]);
  });

  it("ちょうど閾値日数後が締切のタスクは「遠い」側（締切未設定より下位）になる（境界値）", () => {
    const exactlyThreshold = makeTask({
      id: "exact",
      endDate: "2024-01-17", // TODAYからちょうど7日後
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([exactlyThreshold, noDeadline], {}, TODAY, 7).map(
        (t) => t.id,
      ),
    ).toEqual(["no-deadline", "exact"]);
  });

  it("締切超過（マイナス日数）タスクは引き続き「近い」バケットに入り、締切未設定タスクより上位になる", () => {
    const overdue = makeTask({
      id: "overdue",
      endDate: "2024-01-01", // TODAYより9日前（残り日数はマイナス）
    });
    const noDeadline = makeTask({ id: "no-deadline" });
    expect(
      getTodayTasks([noDeadline, overdue], {}, TODAY, 7).map((t) => t.id),
    ).toEqual(["overdue", "no-deadline"]);
  });

  it("閾値が変われば同じタスク集合でもバケット判定（並び順）が変わる", () => {
    const deadline10DaysOut = makeTask({
      id: "deadline-10d",
      endDate: "2024-01-20", // TODAYから10日後
    });
    const noDeadline = makeTask({ id: "no-deadline" });

    // 閾値7日: 10日後は「遠い」→締切未設定より下位
    expect(
      getTodayTasks([deadline10DaysOut, noDeadline], {}, TODAY, 7).map(
        (t) => t.id,
      ),
    ).toEqual(["no-deadline", "deadline-10d"]);

    // 閾値14日: 10日後は「近い」→締切未設定より上位
    expect(
      getTodayTasks([noDeadline, deadline10DaysOut], {}, TODAY, 14).map(
        (t) => t.id,
      ),
    ).toEqual(["deadline-10d", "no-deadline"]);
  });

  it("同じ遠いバケット内でも締切が早い方が上位になる", () => {
    const far1 = makeTask({ id: "far-1", endDate: "2024-01-20" }); // 10日後
    const far2 = makeTask({ id: "far-2", endDate: "2024-01-25" }); // 15日後
    expect(
      getTodayTasks([far2, far1], {}, TODAY, 7).map((t) => t.id),
    ).toEqual(["far-1", "far-2"]);
  });
});
