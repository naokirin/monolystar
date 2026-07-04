/**
 * 定期タスクの繰り返し判定ロジック（仕様書 3.2 / 4.5）。
 *
 * 「基準週」の定義について（仕様書に明記がないため、ここで独自に定義し明示する）:
 * - `biweekly` は「`weekdays` の曜日を指定し、`startDate` が属する週を基準に
 *   2週間おきの『該当週』を判定し、該当週内であれば選択したどの曜日にも
 *   該当する」と定義されている（3.2、複数曜日対応版）。
 * - 複数曜日になると、選択した曜日ごとに `startDate` の曜日との日数差が
 *   7の倍数になるとは限らない（例: `startDate` が水曜日、`weekdays: [1, 3]`
 *   の場合、月曜日は `startDate` との日数差が5・9・…と7の倍数にならない）。
 *   そのため「`dateStr` の曜日一致 + startDateからの日数差が14の倍数」という
 *   単純な判定は使えない。
 * - 代わりに「週の起点（その週の日曜日）」を曜日に依存せず求め、
 *   `dateStr` の週の起点と `startDate` の週の起点の日数差が14の倍数かどうかで
 *   『同じ2週間周期の該当週』を判定する。
 *   - `dateStr` の週の起点までの日数オフセット = `weekdayOfDateStr(dateStr)`
 *   - `startDate` の週の起点までの日数オフセット = `weekdayOfDateStr(startDate)`
 *   - `startDate`→`dateStr` の日数差を `diff` とすると、
 *     両者の週の起点同士の日数差は `diff - weekdayOfDateStr(dateStr) + weekdayOfDateStr(startDate)`
 *     となる（週の起点は必ず7日単位で並ぶため、この値は常に7の倍数）。
 *   - これが14の倍数であれば、`startDate` の週と同じ2週間周期の該当週とみなす。
 * - `startDate` より前の日付についても同じ式がそのまま成り立つ
 *   （有効期間チェックにより通常は除外されるが、ロジック単体としても矛盾なく動作する）。
 */
import type { Recurrence, Task } from "../types";
import { compareDateStr, diffInDays, weekdayOfDateStr } from "./dates";

/**
 * `dateStr` が、`startDate` が属する週を基準とした「隔週の該当週」に
 * 属するかどうかを判定する（曜日には依存しない、週単位の判定）。
 * 週の起点は日曜日として扱う（`weekdayOfDateStr` が0=日を返すことに対応）。
 */
function isSameBiweeklyWeek(startDate: string, dateStr: string): boolean {
  const diff = diffInDays(startDate, dateStr);
  const startWeekday = weekdayOfDateStr(startDate);
  const dateWeekday = weekdayOfDateStr(dateStr);
  // 両者の「週の起点（日曜日）」同士の日数差。必ず7の倍数になる。
  const weekStartDiff = diff - dateWeekday + startWeekday;
  return ((weekStartDiff % 14) + 14) % 14 === 0;
}

/**
 * 有効期間（`startDate`〜`endDate`）内かどうかを判定する。
 * どちらも null の場合はその方向の制限なしとして扱う（仕様書3.1）。
 */
export function isWithinValidPeriod(
  startDate: string | null,
  endDate: string | null,
  dateStr: string,
): boolean {
  if (startDate !== null && compareDateStr(dateStr, startDate) < 0) {
    return false;
  }
  if (endDate !== null && compareDateStr(dateStr, endDate) > 0) {
    return false;
  }
  return true;
}

/**
 * 繰り返しルール単体で、指定日が「該当日」かどうかを判定する
 * （有効期間チェックは含まない。有効期間は `isWithinValidPeriod` で別途確認する）。
 *
 * - `none`: 常に false（繰り返さない）。
 * - `daily`: 常に true。
 * - `weekly`: `dateStr` の曜日が `recurrence.weekdays`（複数曜日）のいずれかと
 *   一致すれば true。
 * - `biweekly`: 上記の曜日一致に加えて `startDate` を基準に2週間おきの該当週
 *   であること。`startDate` が null の場合は基準週を特定できず判定不能なため
 *   false とする（仕様書に明記のない前提のため、安全側＝非該当に倒す独自解釈）。
 * - `weekly`/`biweekly` で `weekdays` が未指定または空配列の場合は非該当とする。
 */
export function isRecurrenceDue(
  recurrence: Recurrence,
  startDate: string | null,
  dateStr: string,
): boolean {
  switch (recurrence.type) {
    case "none":
      return false;

    case "daily":
      return true;

    case "weekly":
      if (!recurrence.weekdays || recurrence.weekdays.length === 0) {
        return false;
      }
      return recurrence.weekdays.includes(weekdayOfDateStr(dateStr));

    case "biweekly": {
      if (!recurrence.weekdays || recurrence.weekdays.length === 0) {
        return false;
      }
      if (!recurrence.weekdays.includes(weekdayOfDateStr(dateStr))) {
        return false;
      }
      if (startDate === null) return false;

      return isSameBiweeklyWeek(startDate, dateStr);
    }

    default:
      return false;
  }
}

/**
 * 定期タスクについて、指定日が「今日やるべき日」に該当するかを判定する
 * （仕様書4.5: 繰り返しルール該当 かつ 有効期間内）。
 * 完了記録（Completions）の有無はこの関数の対象外（呼び出し側で判定する）。
 */
export function isRecurringTaskDueOn(task: Task, dateStr: string): boolean {
  if (!isWithinValidPeriod(task.startDate, task.endDate, dateStr)) {
    return false;
  }
  return isRecurrenceDue(task.recurrence, task.startDate, dateStr);
}
