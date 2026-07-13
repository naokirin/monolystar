/**
 * 「今日」タブの抽出・並び替えロジック（仕様書 4.5）。
 *
 * 抽出条件:
 * - ワンショットタスク（recurrence.type === "none"）:
 *   未完了、かつ startDate が未設定または今日以前であること。
 *   【独自解釈・仕様書4.5からの変更点】仕様書4.5は「endDate が未設定または今日以降」も
 *   抽出条件に含めているが、本実装ではワンショットタスクの endDate 超過を抽出条件に
 *   含めていない。未完了タスクが締切超過を理由に「今日」タブから見えなくなり、
 *   ユーザーが気づけないまま放置されてしまう挙動を避けるため、締切を過ぎても
 *   未完了である限り「今日」タブに残り続ける方針とした（ユーザー要望による）。
 *   endDate は表示可否には使わず、並び替えの締切近さ（deadlineRank）でのみ引き続き使用する。
 *   締切を過ぎたタスクほど deadlineRank の値が小さくなるため、結果的に上位に表示される。
 * - 定期タスク（recurrence.type !== "none"）:
 *   `isRecurringTaskDueOn` で「今日該当」かつ「有効期間内」を判定し、
 *   さらに今日分の完了記録（Completions）が存在しないこと。
 *   定期タスクの startDate/endDate は「繰り返しルールの有効期間」という別概念であり、
 *   上記のワンショットタスクの変更対象外（仕様書4.5・recurrence.ts のロジックを維持）。
 *
 * 並び替え条件（優先順、4段階のタイブレーク）:
 * 1. 目印（marker）: true が false より上位
 * 2. 優先度（must > should）
 * 3. 締切の近さ（3段階のバケット + バケット内の締切近さ）
 *    【追加要件・ユーザー要望】締切がある程度先（`farDeadlineThresholdDays`日以上先）のタスクは、
 *    締切未設定のタスクより下位に並べる（「締切が十分先のタスクより、締切のないタスクを先に
 *    片付けることが多い」というユーザーの運用実感に基づく）。
 *    - バケット0: endDate 設定あり かつ 残り日数 < farDeadlineThresholdDays（締切超過を含む）
 *    - バケット1: endDate 未設定
 *    - バケット2: endDate 設定あり かつ 残り日数 >= farDeadlineThresholdDays（ちょうど閾値日数も含む）
 *    バケットが同じ場合は、従来通り締切日時（endDate + endTime）が早い順に並べる。
 * 4. 開始日の早さ（startDate。未設定の扱いは下記コメント参照）
 */
import type { Completions, Task } from "../types";
import { buildEndDateTime, compareDateStr, diffInDays, todayStr } from "./dates";
import { isRecurringTaskDueOn } from "./recurrence";

/**
 * ワンショットタスクが「今日」タブの対象かどうかを判定する。
 *
 * 条件: 未完了、かつ startDate が未設定または今日以前。
 * 【独自解釈】endDate（締切）が今日より前でも対象から除外しない。理由は上部の
 * ファイル冒頭コメントを参照（未完了タスクを締切超過だけを理由に非表示にしないための方針）。
 */
function isOneShotTaskForToday(task: Task, dateStr: string): boolean {
  if (task.completed) return false;
  if (task.startDate !== null && compareDateStr(dateStr, task.startDate) < 0) {
    return false;
  }
  return true;
}

function isRecurringTaskForToday(
  task: Task,
  completions: Completions,
  dateStr: string,
): boolean {
  if (!isRecurringTaskDueOn(task, dateStr)) return false;
  const key = `${task.id}__${dateStr}`;
  return completions[key] === undefined;
}

/** 目印を比較用の数値に変換する（marker = true が上位＝小さい値）。 */
function markerRank(task: Task): number {
  return task.marker ? 0 : 1;
}

/** 優先度を比較用の数値に変換する（must が上位＝小さい値）。 */
function priorityRank(task: Task): number {
  return task.priority === "must" ? 0 : 1;
}

/**
 * 締切（endDate + endTime）を比較用の数値（エポックms）に変換する。
 * endDate が未設定の場合は仕様書の「締切未設定は最下位扱い」に従い +Infinity を返す。
 */
function deadlineRank(task: Task): number {
  if (task.endDate === null) return Infinity;
  return buildEndDateTime(task.endDate, task.endTime).getTime();
}

/**
 * 締切バケットを判定する（追加要件・ユーザー要望）。
 * 0: 締切あり・近い（残り日数 < farDeadlineThresholdDays。締切超過も含む）
 * 1: 締切未設定
 * 2: 締切あり・遠い（残り日数 >= farDeadlineThresholdDays。ちょうど閾値日数を含む）
 */
function deadlineBucket(
  task: Task,
  dateStr: string,
  farDeadlineThresholdDays: number,
): 0 | 1 | 2 {
  if (task.endDate === null) return 1;
  const remainingDays = diffInDays(dateStr, task.endDate);
  return remainingDays < farDeadlineThresholdDays ? 0 : 2;
}

/**
 * 開始日の早さで2タスクを比較する（`compareDateStr` ベース）。
 * startDate が未設定の場合、開始日による制約がない＝いつでも着手できるタスクであり、
 * 「早く始められる」とみなして最上位（他のどの設定日より早い）として扱う。
 * これはタイブレークの最終段であり、他の基準（優先度・締切）が同点のときのみ効くため、
 * 「開始制約がないタスクを後回しにする理由がない」という考え方に基づく独自解釈。
 * （仕様書に startDate 未設定時の扱いの明記がないため、ここで明示する。）
 */
export function compareStartDate(a: Task, b: Task): number {
  if (a.startDate === null && b.startDate === null) return 0;
  if (a.startDate === null) return -1;
  if (b.startDate === null) return 1;
  return compareDateStr(a.startDate, b.startDate);
}

/**
 * 「今日」タブに表示すべきタスクを抽出し、仕様書4.5の並び替え条件でソートして返す。
 *
 * @param tasks 全タスク
 * @param completions 定期タスクの完了記録
 * @param dateStr 基準日（省略時は実行時点の今日）。テストで任意の日付を注入するために公開。
 * @param farDeadlineThresholdDays 締切を「遠い」（締切未設定より下位）とみなす残り日数の閾値。
 *   `Prefs.farDeadlineThresholdDays`（デフォルト7日）に対応。
 */
export function getTodayTasks(
  tasks: Task[],
  completions: Completions,
  dateStr: string = todayStr(),
  farDeadlineThresholdDays: number,
): Task[] {
  const filtered = tasks.filter((task) => {
    if (task.deletedAt !== null) return false;
    if (task.recurrence.type === "none") {
      return isOneShotTaskForToday(task, dateStr);
    }
    return isRecurringTaskForToday(task, completions, dateStr);
  });

  return [...filtered].sort((a, b) => {
    const markerDiff = markerRank(a) - markerRank(b);
    if (markerDiff !== 0) return markerDiff;

    const priorityDiff = priorityRank(a) - priorityRank(b);
    if (priorityDiff !== 0) return priorityDiff;

    const bucketDiff =
      deadlineBucket(a, dateStr, farDeadlineThresholdDays) -
      deadlineBucket(b, dateStr, farDeadlineThresholdDays);
    if (bucketDiff !== 0) return bucketDiff;

    const deadlineDiff = deadlineRank(a) - deadlineRank(b);
    if (deadlineDiff !== 0) return deadlineDiff;

    return compareStartDate(a, b);
  });
}
