export type Priority = "must" | "should";

export type RecurrenceType = "none" | "daily" | "weekly" | "biweekly";

export interface Recurrence {
  type: RecurrenceType;
  /** 0=日〜6=土の配列（1件以上）。weekly / biweekly のみ使用。複数曜日を選択可能。 */
  weekdays?: number[];
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  priority: Priority;
  category: string;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  recurrence: Recurrence;
  completed: boolean;
  completedAt: number | null;
  /**
   * ユーザーが自由に使える目印（しおり/インデックスタブ）。
   * 完了とは独立した中間状態の印として利用する（例: 進行中・気になる）。
   * true=目印あり。既定 false。インポート時のマージは updatedAt による LWW に従う（8.5）。
   */
  marker: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  notifiedStart: boolean;
  notifiedEndSoon: boolean;
}

/** キー形式: `{taskId}__{YYYY-MM-DD}` */
export type Completions = Record<string, { at: number }>;

export interface Prefs {
  notif: boolean;
  /**
   * 「今日」タブの締切ソートで「締切未設定より後ろ」に回す閾値（日数）。
   * 締切までの残り日数がこの値以上のタスクは、締切未設定タスクより下位に表示する。
   * 未設定（旧バージョンのデータ等）の場合は呼び出し側で既定値7にフォールバックする。
   */
  farDeadlineThresholdDays: number;
  updatedAt: number;
}

export interface SyncFile {
  schemaVersion: 1;
  exportedAt: number;
  deviceId: string;
  tasks: Task[];
  completions: Completions;
  prefs: Prefs;
}
