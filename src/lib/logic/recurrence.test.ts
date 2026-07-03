import { describe, expect, it } from "vitest";
import type { Recurrence, Task } from "../types";
import {
  isRecurrenceDue,
  isRecurringTaskDueOn,
  isWithinValidPeriod,
} from "./recurrence";

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
    ...overrides,
  };
}

describe("isRecurrenceDue - none", () => {
  it("常に非該当", () => {
    const recurrence: Recurrence = { type: "none" };
    expect(isRecurrenceDue(recurrence, null, "2024-01-01")).toBe(false);
  });
});

describe("isRecurrenceDue - daily", () => {
  it("どの曜日でも常に該当", () => {
    const recurrence: Recurrence = { type: "daily" };
    expect(isRecurrenceDue(recurrence, null, "2024-01-07")).toBe(true); // 日
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(true); // 水
  });
});

describe("isRecurrenceDue - weekly", () => {
  it("指定曜日と一致する日は該当する", () => {
    // 2024-01-10 は水曜日
    const recurrence: Recurrence = { type: "weekly", weekday: 3 };
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(true);
  });

  it("指定曜日以外の日は該当しない", () => {
    const recurrence: Recurrence = { type: "weekly", weekday: 3 };
    // 前日（火曜）・翌日（木曜）はいずれも非該当
    expect(isRecurrenceDue(recurrence, null, "2024-01-09")).toBe(false);
    expect(isRecurrenceDue(recurrence, null, "2024-01-11")).toBe(false);
  });

  it("日曜(0)・土曜(6)の境界でも正しく判定する", () => {
    const sunday: Recurrence = { type: "weekly", weekday: 0 };
    const saturday: Recurrence = { type: "weekly", weekday: 6 };
    expect(isRecurrenceDue(sunday, null, "2024-01-07")).toBe(true);
    expect(isRecurrenceDue(sunday, null, "2024-01-06")).toBe(false);
    expect(isRecurrenceDue(saturday, null, "2024-01-06")).toBe(true);
    expect(isRecurrenceDue(saturday, null, "2024-01-07")).toBe(false);
  });
});

describe("isRecurrenceDue - biweekly", () => {
  const recurrence: Recurrence = { type: "biweekly", weekday: 3 }; // 水曜日
  const startDate = "2024-01-03"; // 水曜日（基準週）

  it("startDateと同じ日（基準週）は該当する", () => {
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-03")).toBe(true);
  });

  it("基準週の翌週（1週間後）は該当しない", () => {
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-10")).toBe(false);
  });

  it("基準週の2週間後は該当する", () => {
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-17")).toBe(true);
  });

  it("基準週の3週間後（奇数週）は該当しない", () => {
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-24")).toBe(false);
  });

  it("基準週の4週間後（偶数週）は該当する", () => {
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-31")).toBe(true);
  });

  it("曜日が一致しない日は隔週判定に関わらず非該当", () => {
    // 2024-01-18 は木曜日（2週間後の翌日）
    expect(isRecurrenceDue(recurrence, startDate, "2024-01-18")).toBe(false);
  });

  it("weekdayが未指定の場合は非該当", () => {
    const invalid: Recurrence = { type: "biweekly" };
    expect(isRecurrenceDue(invalid, startDate, "2024-01-03")).toBe(false);
  });

  it("startDateがnullの場合は基準週を特定できないため非該当（独自解釈）", () => {
    expect(isRecurrenceDue(recurrence, null, "2024-01-03")).toBe(false);
  });

  it("年またぎでも基準週判定が正しい", () => {
    // startDate: 2023-12-06（水曜日）を基準に、年をまたいだ2週間後・1週間後を検証
    const start = "2023-12-06";
    expect(isRecurrenceDue(recurrence, start, "2023-12-20")).toBe(true); // 2週間後
    expect(isRecurrenceDue(recurrence, start, "2023-12-27")).toBe(false); // 3週間後
    expect(isRecurrenceDue(recurrence, start, "2024-01-03")).toBe(true); // 4週間後（年またぎ）
    expect(isRecurrenceDue(recurrence, start, "2023-12-13")).toBe(false); // 1週間後
  });

  it("月またぎでも基準週判定が正しい", () => {
    // startDate: 2024-01-31（水曜日）を基準に、月をまたいだ2週間後を検証
    const start = "2024-01-31";
    expect(isRecurrenceDue(recurrence, start, "2024-02-14")).toBe(true); // 2週間後
    expect(isRecurrenceDue(recurrence, start, "2024-02-07")).toBe(false); // 1週間後
  });

  it("startDateより前の日付でも14日周期が合えば該当する", () => {
    // startDateの2週間前も同じ「偶数週」に属する
    expect(isRecurrenceDue(recurrence, startDate, "2023-12-20")).toBe(true);
    // startDateの1週間前は「奇数週」で非該当
    expect(isRecurrenceDue(recurrence, startDate, "2023-12-27")).toBe(false);
  });

  it("startDateが日曜・土曜など週境界の曜日でも正しく機能する", () => {
    const sundayRecurrence: Recurrence = { type: "biweekly", weekday: 0 };
    const sundayStart = "2024-01-07"; // 日曜日
    expect(isRecurrenceDue(sundayRecurrence, sundayStart, "2024-01-14")).toBe(
      false,
    ); // 1週間後
    expect(isRecurrenceDue(sundayRecurrence, sundayStart, "2024-01-21")).toBe(
      true,
    ); // 2週間後

    const saturdayRecurrence: Recurrence = { type: "biweekly", weekday: 6 };
    const saturdayStart = "2024-01-06"; // 土曜日
    expect(
      isRecurrenceDue(saturdayRecurrence, saturdayStart, "2024-01-13"),
    ).toBe(false); // 1週間後
    expect(
      isRecurrenceDue(saturdayRecurrence, saturdayStart, "2024-01-20"),
    ).toBe(true); // 2週間後
  });
});

describe("isWithinValidPeriod", () => {
  it("startDate/endDateともにnullなら常に範囲内", () => {
    expect(isWithinValidPeriod(null, null, "2024-01-01")).toBe(true);
  });

  it("startDateより前は範囲外", () => {
    expect(isWithinValidPeriod("2024-01-10", null, "2024-01-09")).toBe(false);
  });

  it("startDate当日は範囲内", () => {
    expect(isWithinValidPeriod("2024-01-10", null, "2024-01-10")).toBe(true);
  });

  it("endDateより後は範囲外", () => {
    expect(isWithinValidPeriod(null, "2024-01-10", "2024-01-11")).toBe(false);
  });

  it("endDate当日は範囲内", () => {
    expect(isWithinValidPeriod(null, "2024-01-10", "2024-01-10")).toBe(true);
  });

  it("startDate〜endDateの範囲内は該当", () => {
    expect(
      isWithinValidPeriod("2024-01-01", "2024-01-31", "2024-01-15"),
    ).toBe(true);
  });
});

describe("isRecurringTaskDueOn", () => {
  it("有効期間外なら繰り返しルールに該当しても対象外", () => {
    const task = makeTask({
      recurrence: { type: "daily" },
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
    expect(isRecurringTaskDueOn(task, "2024-01-31")).toBe(false);
    expect(isRecurringTaskDueOn(task, "2024-03-01")).toBe(false);
    expect(isRecurringTaskDueOn(task, "2024-02-15")).toBe(true);
  });

  it("weeklyで有効期間内かつ指定曜日なら該当", () => {
    const task = makeTask({
      recurrence: { type: "weekly", weekday: 3 }, // 水曜日
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(isRecurringTaskDueOn(task, "2024-01-10")).toBe(true); // 水曜
    expect(isRecurringTaskDueOn(task, "2024-01-11")).toBe(false); // 木曜
  });

  it("biweeklyで有効期間・基準週・曜日すべてを満たす場合のみ該当", () => {
    const task = makeTask({
      recurrence: { type: "biweekly", weekday: 3 },
      startDate: "2024-01-03",
      endDate: null,
    });
    expect(isRecurringTaskDueOn(task, "2024-01-03")).toBe(true);
    expect(isRecurringTaskDueOn(task, "2024-01-10")).toBe(false);
    expect(isRecurringTaskDueOn(task, "2024-01-17")).toBe(true);
  });

  it("noneは常に非該当", () => {
    const task = makeTask({ recurrence: { type: "none" } });
    expect(isRecurringTaskDueOn(task, "2024-01-01")).toBe(false);
  });
});
