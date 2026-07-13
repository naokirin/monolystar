import { describe, expect, it } from "vitest";
import {
  buildEndDateTime,
  buildStartDateTime,
  compareDateStr,
  diffInDays,
  isDeadlineUrgent,
  todayStr,
  weekdayOfDateStr,
} from "./dates";

describe("todayStr", () => {
  it("ローカル日時からYYYY-MM-DD形式を返す", () => {
    // 2024-03-05 09:30 ローカル
    const d = new Date(2024, 2, 5, 9, 30, 0);
    expect(todayStr(d)).toBe("2024-03-05");
  });

  it("月・日を2桁ゼロ埋めする", () => {
    const d = new Date(2024, 0, 1, 0, 0, 0);
    expect(todayStr(d)).toBe("2024-01-01");
  });

  it("UTC変換によるズレが起きないこと（日付が変わる境界時刻）", () => {
    // ローカル深夜0時台。toISOString()を使うとUTC変換でズレる可能性がある時刻。
    const d = new Date(2024, 5, 1, 0, 10, 0);
    expect(todayStr(d)).toBe("2024-06-01");
  });
});

describe("compareDateStr", () => {
  it("同じ日付は0", () => {
    expect(compareDateStr("2024-01-01", "2024-01-01")).toBe(0);
  });

  it("aが過去なら負の値", () => {
    expect(compareDateStr("2024-01-01", "2024-01-02")).toBeLessThan(0);
  });

  it("aが未来なら正の値", () => {
    expect(compareDateStr("2024-02-01", "2024-01-31")).toBeGreaterThan(0);
  });

  it("年をまたぐ比較も正しい", () => {
    expect(compareDateStr("2023-12-31", "2024-01-01")).toBeLessThan(0);
  });
});

describe("weekdayOfDateStr", () => {
  it("日曜日は0", () => {
    // 2024-01-07 は日曜日
    expect(weekdayOfDateStr("2024-01-07")).toBe(0);
  });

  it("土曜日は6", () => {
    // 2024-01-06 は土曜日
    expect(weekdayOfDateStr("2024-01-06")).toBe(6);
  });

  it("平日の曜日も正しい（水曜日）", () => {
    // 2024-01-10 は水曜日
    expect(weekdayOfDateStr("2024-01-10")).toBe(3);
  });
});

describe("diffInDays", () => {
  it("同日は0", () => {
    expect(diffInDays("2024-01-01", "2024-01-01")).toBe(0);
  });

  it("翌日は1", () => {
    expect(diffInDays("2024-01-01", "2024-01-02")).toBe(1);
  });

  it("過去日を指定すると負の値", () => {
    expect(diffInDays("2024-01-10", "2024-01-01")).toBe(-9);
  });

  it("月またぎでも正しい", () => {
    expect(diffInDays("2024-01-31", "2024-02-01")).toBe(1);
  });

  it("年またぎでも正しい", () => {
    expect(diffInDays("2023-12-31", "2024-01-01")).toBe(1);
  });

  it("うるう年をまたいでも正しい（2024年は閏年）", () => {
    expect(diffInDays("2024-02-28", "2024-03-01")).toBe(2);
  });
});

describe("buildStartDateTime", () => {
  it("開始時刻未設定時は当日00:00になる", () => {
    const dt = buildStartDateTime("2024-05-10", null);
    expect(dt.getFullYear()).toBe(2024);
    expect(dt.getMonth()).toBe(4);
    expect(dt.getDate()).toBe(10);
    expect(dt.getHours()).toBe(0);
    expect(dt.getMinutes()).toBe(0);
  });

  it("開始時刻が設定されていればその時刻になる", () => {
    const dt = buildStartDateTime("2024-05-10", "08:15");
    expect(dt.getHours()).toBe(8);
    expect(dt.getMinutes()).toBe(15);
  });
});

describe("buildEndDateTime", () => {
  it("終了時刻未設定時は当日23:59になる", () => {
    const dt = buildEndDateTime("2024-05-10", null);
    expect(dt.getHours()).toBe(23);
    expect(dt.getMinutes()).toBe(59);
  });

  it("終了時刻が設定されていればその時刻になる", () => {
    const dt = buildEndDateTime("2024-05-10", "18:30");
    expect(dt.getHours()).toBe(18);
    expect(dt.getMinutes()).toBe(30);
  });
});

describe("isDeadlineUrgent", () => {
  it("endDateが未設定なら常にfalse", () => {
    expect(isDeadlineUrgent(null, null, Date.now())).toBe(false);
  });

  it("締切まで24時間より十分先はfalse", () => {
    const now = new Date(2024, 4, 10, 9, 0).getTime();
    expect(isDeadlineUrgent("2024-05-12", "09:00", now)).toBe(false);
  });

  it("締切まで24時間以内（未来）はtrue", () => {
    const now = new Date(2024, 4, 10, 9, 0).getTime();
    expect(isDeadlineUrgent("2024-05-11", "08:00", now)).toBe(true);
  });

  it("締切ちょうど24時間後はtrue（境界値）", () => {
    const now = new Date(2024, 4, 10, 9, 0).getTime();
    expect(isDeadlineUrgent("2024-05-11", "09:00", now)).toBe(true);
  });

  it("締切を過ぎている（超過）場合もtrue（独自解釈）", () => {
    const now = new Date(2024, 4, 10, 9, 0).getTime();
    expect(isDeadlineUrgent("2024-05-01", "09:00", now)).toBe(true);
  });

  it("終了時刻未設定時は当日23:59を締切として判定する", () => {
    const now = new Date(2024, 4, 10, 9, 0).getTime();
    expect(isDeadlineUrgent("2024-05-10", null, now)).toBe(true);
  });
});
