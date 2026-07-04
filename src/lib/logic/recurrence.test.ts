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
    const recurrence: Recurrence = { type: "weekly", weekdays: [3] };
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(true);
  });

  it("指定曜日以外の日は該当しない", () => {
    const recurrence: Recurrence = { type: "weekly", weekdays: [3] };
    // 前日（火曜）・翌日（木曜）はいずれも非該当
    expect(isRecurrenceDue(recurrence, null, "2024-01-09")).toBe(false);
    expect(isRecurrenceDue(recurrence, null, "2024-01-11")).toBe(false);
  });

  it("日曜(0)・土曜(6)の境界でも正しく判定する", () => {
    const sunday: Recurrence = { type: "weekly", weekdays: [0] };
    const saturday: Recurrence = { type: "weekly", weekdays: [6] };
    expect(isRecurrenceDue(sunday, null, "2024-01-07")).toBe(true);
    expect(isRecurrenceDue(sunday, null, "2024-01-06")).toBe(false);
    expect(isRecurrenceDue(saturday, null, "2024-01-06")).toBe(true);
    expect(isRecurrenceDue(saturday, null, "2024-01-07")).toBe(false);
  });

  it("複数曜日（月・水・金）を指定した場合、それぞれの曜日で該当する", () => {
    // 2024-01-08=月, 01-10=水, 01-12=金
    const recurrence: Recurrence = { type: "weekly", weekdays: [1, 3, 5] };
    expect(isRecurrenceDue(recurrence, null, "2024-01-08")).toBe(true); // 月
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(true); // 水
    expect(isRecurrenceDue(recurrence, null, "2024-01-12")).toBe(true); // 金
  });

  it("複数曜日指定時、それ以外の曜日では非該当", () => {
    // 2024-01-09=火, 01-11=木, 01-13=土, 01-14=日
    const recurrence: Recurrence = { type: "weekly", weekdays: [1, 3, 5] };
    expect(isRecurrenceDue(recurrence, null, "2024-01-09")).toBe(false); // 火
    expect(isRecurrenceDue(recurrence, null, "2024-01-11")).toBe(false); // 木
    expect(isRecurrenceDue(recurrence, null, "2024-01-13")).toBe(false); // 土
    expect(isRecurrenceDue(recurrence, null, "2024-01-14")).toBe(false); // 日
  });

  it("weekdaysが空配列の場合は非該当", () => {
    const recurrence: Recurrence = { type: "weekly", weekdays: [] };
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(false);
  });

  it("weekdaysが未指定の場合は非該当", () => {
    const recurrence: Recurrence = { type: "weekly" };
    expect(isRecurrenceDue(recurrence, null, "2024-01-10")).toBe(false);
  });
});

describe("isRecurrenceDue - biweekly", () => {
  const recurrence: Recurrence = { type: "biweekly", weekdays: [3] }; // 水曜日
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

  it("weekdaysが未指定の場合は非該当", () => {
    const invalid: Recurrence = { type: "biweekly" };
    expect(isRecurrenceDue(invalid, startDate, "2024-01-03")).toBe(false);
  });

  it("weekdaysが空配列の場合は非該当", () => {
    const invalid: Recurrence = { type: "biweekly", weekdays: [] };
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
    const sundayRecurrence: Recurrence = { type: "biweekly", weekdays: [0] };
    const sundayStart = "2024-01-07"; // 日曜日
    expect(isRecurrenceDue(sundayRecurrence, sundayStart, "2024-01-14")).toBe(
      false,
    ); // 1週間後
    expect(isRecurrenceDue(sundayRecurrence, sundayStart, "2024-01-21")).toBe(
      true,
    ); // 2週間後

    const saturdayRecurrence: Recurrence = { type: "biweekly", weekdays: [6] };
    const saturdayStart = "2024-01-06"; // 土曜日
    expect(
      isRecurrenceDue(saturdayRecurrence, saturdayStart, "2024-01-13"),
    ).toBe(false); // 1週間後
    expect(
      isRecurrenceDue(saturdayRecurrence, saturdayStart, "2024-01-20"),
    ).toBe(true); // 2週間後
  });

  describe("複数曜日指定（月・水）", () => {
    // startDateは水曜日。月曜日はstartDateより2日前の曜日で、
    // 「startDateからの日数差が7の倍数」という単純な前提が崩れるケース。
    const multiRecurrence: Recurrence = {
      type: "biweekly",
      weekdays: [1, 3], // 月・水
    };
    const multiStart = "2024-01-03"; // 水曜日（基準週）

    it("基準週内では月・水の両方に該当する", () => {
      // 2024-01-01は月曜日、2024-01-03は水曜日（同じ基準週）
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-01")).toBe(
        true,
      );
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-03")).toBe(
        true,
      );
    });

    it("1週間後（非該当週）では月・水のどちらも非該当", () => {
      // 2024-01-08は月曜日、2024-01-10は水曜日（1週間後）
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-08")).toBe(
        false,
      );
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-10")).toBe(
        false,
      );
    });

    it("2週間後（該当週）では月・水の両方に再度該当する", () => {
      // 2024-01-15は月曜日、2024-01-17は水曜日（2週間後）
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-15")).toBe(
        true,
      );
      expect(isRecurrenceDue(multiRecurrence, multiStart, "2024-01-17")).toBe(
        true,
      );
    });

    it("startDate自身の曜日より前の曜日（月曜）を含む指定でも、月またぎ・年またぎで正しく機能する", () => {
      // startDateを2024-01-31（水曜日）にして、月をまたいだ月曜日側も検証
      const crossMonthStart = "2024-01-31";
      // 2024-02-12は月曜日、2024-02-14は水曜日（2週間後の基準週）
      expect(
        isRecurrenceDue(multiRecurrence, crossMonthStart, "2024-02-12"),
      ).toBe(true);
      expect(
        isRecurrenceDue(multiRecurrence, crossMonthStart, "2024-02-14"),
      ).toBe(true);
      // 2024-02-05は月曜日、2024-02-07は水曜日（1週間後、非該当週）
      expect(
        isRecurrenceDue(multiRecurrence, crossMonthStart, "2024-02-05"),
      ).toBe(false);
      expect(
        isRecurrenceDue(multiRecurrence, crossMonthStart, "2024-02-07"),
      ).toBe(false);
    });
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
      recurrence: { type: "weekly", weekdays: [3] }, // 水曜日
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(isRecurringTaskDueOn(task, "2024-01-10")).toBe(true); // 水曜
    expect(isRecurringTaskDueOn(task, "2024-01-11")).toBe(false); // 木曜
  });

  it("weeklyで複数曜日指定かつ有効期間内なら該当", () => {
    const task = makeTask({
      recurrence: { type: "weekly", weekdays: [1, 3, 5] }, // 月・水・金
      startDate: "2024-01-01",
      endDate: "2024-12-31",
    });
    expect(isRecurringTaskDueOn(task, "2024-01-08")).toBe(true); // 月曜
    expect(isRecurringTaskDueOn(task, "2024-01-10")).toBe(true); // 水曜
    expect(isRecurringTaskDueOn(task, "2024-01-12")).toBe(true); // 金曜
    expect(isRecurringTaskDueOn(task, "2024-01-09")).toBe(false); // 火曜
  });

  it("biweeklyで有効期間・基準週・曜日すべてを満たす場合のみ該当", () => {
    const task = makeTask({
      recurrence: { type: "biweekly", weekdays: [3] },
      startDate: "2024-01-03",
      endDate: null,
    });
    expect(isRecurringTaskDueOn(task, "2024-01-03")).toBe(true);
    expect(isRecurringTaskDueOn(task, "2024-01-10")).toBe(false);
    expect(isRecurringTaskDueOn(task, "2024-01-17")).toBe(true);
  });

  it("biweeklyで複数曜日指定の場合、有効期間外は非該当", () => {
    const task = makeTask({
      recurrence: { type: "biweekly", weekdays: [1, 3] }, // 月・水
      startDate: "2024-01-03", // 水曜日（基準週）
      endDate: "2024-01-05",
    });
    // 基準週内の月曜日だが、有効期間開始（startDate）より前なので非該当
    expect(isRecurringTaskDueOn(task, "2024-01-01")).toBe(false);
    // 基準週内で有効期間内の水曜日は該当
    expect(isRecurringTaskDueOn(task, "2024-01-03")).toBe(true);
    // 2週間後の月曜日は該当週だが有効期間外（endDateより後）なので非該当
    expect(isRecurringTaskDueOn(task, "2024-01-15")).toBe(false);
  });

  it("noneは常に非該当", () => {
    const task = makeTask({ recurrence: { type: "none" } });
    expect(isRecurringTaskDueOn(task, "2024-01-01")).toBe(false);
  });
});
