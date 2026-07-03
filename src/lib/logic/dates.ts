/**
 * 日付ユーティリティ。
 *
 * 方針:
 * - すべての「日付」は `YYYY-MM-DD` 形式の文字列として扱い、日単位の演算
 *   （曜日判定・日数差分）は UTC 正午に固定した Date を経由することで、
 *   タイムゾーンやサマータイムによる日跨ぎのズレを避ける。
 * - `Date#toISOString()` はローカル日付をUTCに変換してしまうため、
 *   「今日の日付文字列」を得る用途では使用しない。
 * - 一方、通知判定（仕様書5.2/5.3）のように実際の時刻を伴う比較が必要な
 *   箇所は、意図的にローカルタイムの Date を組み立てる関数を別途用意する。
 */

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * ローカルタイムゾーン基準で「今日」を `YYYY-MM-DD` 形式で返す。
 * `now` を省略した場合は `new Date()`（実行時点のローカル時刻）を用いる。
 */
export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * `YYYY-MM-DD` 形式の日付文字列同士を比較する。
 * この形式は辞書順比較がそのまま日付の大小と一致する。
 *
 * @returns a < b なら負の値、a === b なら 0、a > b なら正の値
 */
export function compareDateStr(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * `YYYY-MM-DD` の日付文字列を、UTC正午を基準にした Date に変換する。
 * 日単位の差分計算（曜日判定・週数計算）専用の内部ヘルパー。
 * ローカルタイムの Date コンストラクタ（時刻部分を持つ）は
 * DSTの影響を受けうるため、ここでは使用しない。
 */
function dateStrToUtcNoon(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/**
 * 日付文字列の曜日を返す（0=日〜6=土）。
 */
export function weekdayOfDateStr(dateStr: string): number {
  return dateStrToUtcNoon(dateStr).getUTCDay();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 2つの日付文字列の日数差（b - a）を返す。
 * UTC正午基準で計算するため、タイムゾーンやサマータイムの影響を受けない。
 * 年またぎ・月またぎでも通常の日数として正しく計算される。
 */
export function diffInDays(a: string, b: string): number {
  const diffMs = dateStrToUtcNoon(b).getTime() - dateStrToUtcNoon(a).getTime();
  return Math.round(diffMs / MS_PER_DAY);
}

/**
 * `YYYY-MM-DD` と `HH:MM`（省略時は defaultTime）から、
 * ローカルタイムゾーンの日時を表す Date を組み立てる。
 */
function buildLocalDateTime(
  dateStr: string,
  timeStr: string | null,
  defaultTime: string,
): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr ?? defaultTime).split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * startDate/startTime の組から、開始日時を表すローカル Date を組み立てる。
 * 仕様書5.2: 開始時刻未設定時は当日00:00として扱う。
 */
export function buildStartDateTime(
  startDate: string,
  startTime: string | null,
): Date {
  return buildLocalDateTime(startDate, startTime, "00:00");
}

/**
 * endDate/endTime の組から、終了日時を表すローカル Date を組み立てる。
 * 仕様書5.3: 終了時刻未設定時は当日23:59として扱う。
 */
export function buildEndDateTime(
  endDate: string,
  endTime: string | null,
): Date {
  return buildLocalDateTime(endDate, endTime, "23:59");
}
