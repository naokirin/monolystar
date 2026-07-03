/**
 * 定期タスクの繰り返し判定ロジック（仕様書 3.2 / 4.5）。
 *
 * 「基準週」の定義について（仕様書に明記がないため、ここで独自に定義し明示する）:
 * - `biweekly` は「`startDate` を基準週として2週間おき」と定義されている（3.2）。
 * - `weekday` が一致する日は、`startDate` からの日数差が必ず7の倍数になる
 *   （曜日が同じであれば7日周期でしか一致しないため）。
 * - そのため「隔週の基準週の起点をどの曜日にするか」という問題を持ち出さずとも、
 *   「startDateからの日数差が14の倍数かどうか」だけで一意に判定できる。
 *   （例: startDateの週を偶数週として、そこから2週おきに該当させる、という
 *   考え方と等価であり、週の起点を「日曜始まり」等に固定する必要がない。）
 * - `startDate` より前の日付は、7日周期を逆方向にたどった上で14日周期に
 *   乗るかどうかで判定される（有効期間チェックにより通常は除外されるが、
 *   ロジック単体としても矛盾なく動作する）。
 */
import type { Recurrence, Task } from "../types";
import { compareDateStr, diffInDays, weekdayOfDateStr } from "./dates";

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
 * - `weekly`: `dateStr` の曜日が `recurrence.weekday` と一致すれば true。
 * - `biweekly`: 上記に加えて `startDate` を基準に2週間おきの該当週であること。
 *   `startDate` が null の場合は基準週を特定できず判定不能なため false とする
 *   （仕様書に明記のない前提のため、安全側＝非該当に倒す独自解釈）。
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
      if (recurrence.weekday === undefined) return false;
      return weekdayOfDateStr(dateStr) === recurrence.weekday;

    case "biweekly": {
      if (recurrence.weekday === undefined) return false;
      if (weekdayOfDateStr(dateStr) !== recurrence.weekday) return false;
      if (startDate === null) return false;

      const diff = diffInDays(startDate, dateStr);
      // 曜日が一致している時点で diff は7の倍数のはず。
      // 14の倍数（2週おき）かどうかで隔週該当を判定する。
      // 負の値も含めて正しく判定できるよう ((n % 14) + 14) % 14 で正規化する。
      return ((diff % 14) + 14) % 14 === 0;
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
