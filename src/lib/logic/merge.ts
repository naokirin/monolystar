/**
 * 複数端末同期のマージ・競合解決ロジック（仕様書 8.5）。
 *
 * データ損失リスクが最も高い領域のため、ルールの変更は必ず仕様書 8.5 を
 * 確認したうえで、破壊的な挙動変更（削除伝播・LWW比較キー等）はユーザーに
 * 確認してから行うこと。
 */
import type { Completions, Prefs, Task } from "../types";

/**
 * 「同期間隔」のデフォルト値（ミリ秒）。
 * 仕様書 8.3.2 で「タブ表示中: 60秒間隔」で同期を行うと定義されているため、
 * それに合わせて既定値を 60秒 とする。呼び出し側（ファイル同期／WebDAV等）が
 * 実際の同期間隔を把握している場合は、その値を明示的に渡すこと。
 */
export const DEFAULT_SYNC_INTERVAL_MS = 60_000;

/**
 * 「内容が異なる」の判定に使うフィールド一覧。
 * `updatedAt` / `deletedAt` は比較対象から除外する
 * （これらは「いつ変わったか」を示すメタ情報であり、「何が変わったか」の
 * 判定に含めると、同じ内容でも常に競合扱いになってしまうため）。
 * `completed` / `completedAt` は Task 側のフィールドとして比較対象に含める
 * （Completions とは別に Task 自体にも保持されているため）。
 */
const CONTENT_FIELDS: readonly (keyof Task)[] = [
  "title",
  "detail",
  "priority",
  "category",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "recurrence",
  "completed",
  "completedAt",
  "notifiedStart",
  "notifiedEndSoon",
  "marker",
];

function contentDiffers(a: Task, b: Task): boolean {
  return CONTENT_FIELDS.some((field) => {
    const va = a[field];
    const vb = b[field];
    if (field === "recurrence") {
      return JSON.stringify(va) !== JSON.stringify(vb);
    }
    return va !== vb;
  });
}

/**
 * 1件の Task ペア（同一 id のローカル／リモート）をマージする。
 *
 * ルール（仕様書 8.5、優先順位順）:
 * 1. 一方にのみ `deletedAt` がある場合: そちらを採用する（削除の伝播）。
 *    ※「より新しい deletedAt を採用」という表現は、削除操作自体が
 *      一方にしか存在しない状況を指しており、「両方に deletedAt がある」
 *      ケースは次の LWW ルールに委ねる（deletedAt も updatedAt 更新を
 *      伴う操作として扱う）。これにより「片方で削除・片方で別フィールド
 *      更新」のようなケースでも、常に updatedAt が新しい方が勝つという
 *      一貫したルールになる。
 * 2. 両方に deletedAt がある、または両方とも deletedAt がない場合:
 *    `updatedAt` が新しい方を採用する（LWW）。同点の場合はローカルを
 *    優先する（同一内容であることが多く、任意の一貫した決定が必要なため。
 *    「常にどちらか一方に倒す」という決定はデータを失わない選択であり、
 *    どちらのタスクも同じ id・ほぼ同じ内容であるためリスクは低い）。
 */
function mergeTaskPair(local: Task, remote: Task): Task {
  const localDeleted = local.deletedAt !== null;
  const remoteDeleted = remote.deletedAt !== null;

  if (localDeleted !== remoteDeleted) {
    // 削除の伝播: 片方にのみ deletedAt があれば、削除されている方を採用する。
    return localDeleted ? local : remote;
  }

  // 両方削除済み、または両方未削除 → updatedAt の新しい方（LWW）。
  return remote.updatedAt > local.updatedAt ? remote : local;
}

export interface MergeTasksResult {
  merged: Task[];
  /** 「競合候補」件数（8.5末尾）。マージ結果そのものには影響しない集計値。 */
  conflictCount: number;
}

/**
 * ローカル／リモートの Task 配列をマージする（仕様書 8.5）。
 *
 * - `id` で対応付ける。
 * - 削除されたタスク（deletedAt !== null）も含めて返す。表示上のフィルタリング
 *   は呼び出し側の関心事とする（削除の伝播を継続させるため、マージ結果からは
 *   削除タスクを取り除かない）。
 * - 競合候補の判定（8.5末尾）: 同一 id のタスクで、両端末の `updatedAt` の
 *   差が `syncIntervalMs` 以内 かつ 内容（CONTENT_FIELDS）が異なる場合に
 *   1件とカウントする。この集計はマージ結果を変更しない、通知用の
 *   副次的な情報である。
 */
export function mergeTasks(
  localTasks: Task[],
  remoteTasks: Task[],
  syncIntervalMs: number = DEFAULT_SYNC_INTERVAL_MS,
): MergeTasksResult {
  const localById = new Map(localTasks.map((t) => [t.id, t]));
  const remoteById = new Map(remoteTasks.map((t) => [t.id, t]));

  const allIds = new Set<string>([...localById.keys(), ...remoteById.keys()]);

  const merged: Task[] = [];
  let conflictCount = 0;

  for (const id of allIds) {
    const local = localById.get(id);
    const remote = remoteById.get(id);

    if (local && remote) {
      if (
        Math.abs(local.updatedAt - remote.updatedAt) <= syncIntervalMs &&
        contentDiffers(local, remote)
      ) {
        conflictCount++;
      }
      merged.push(mergeTaskPair(local, remote));
    } else if (local) {
      // 片方（ローカル）にのみ存在 → そのまま取り込む。
      merged.push(local);
    } else if (remote) {
      // 片方（リモート）にのみ存在 → そのまま取り込む。
      merged.push(remote);
    }
  }

  return { merged, conflictCount };
}

/**
 * 完了履歴（Completions）をマージする（仕様書 8.5）。
 *
 * 同一キー（`{taskId}__{YYYY-MM-DD}`）について `at` が新しい方を採用する。
 * Phase 1 では「完了記録の追加のみ」をマージ対象とし、未完了への削除マーカー
 * （キー削除の伝播）は仕様上未実装のため、ここでも実装しない
 * （将来 Phase で明示的な削除マーカーが定義された場合に再検討する）。
 */
export function mergeCompletions(
  local: Completions,
  remote: Completions,
): Completions {
  const merged: Completions = { ...local };

  for (const key of Object.keys(remote)) {
    const remoteEntry = remote[key];
    const localEntry = merged[key];
    if (!localEntry || remoteEntry.at > localEntry.at) {
      merged[key] = remoteEntry;
    }
  }

  return merged;
}

/**
 * 通知設定（Prefs）をマージする（仕様書 8.5）。
 * `updatedAt` が新しい方を採用する。同点の場合はローカルを優先する。
 */
export function mergePrefs(local: Prefs, remote: Prefs): Prefs {
  return remote.updatedAt > local.updatedAt ? remote : local;
}
