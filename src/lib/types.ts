export type Priority = "must" | "should";

export type RecurrenceType = "none" | "daily" | "weekly" | "biweekly";

export interface Recurrence {
  type: RecurrenceType;
  /** 0=日〜6=土。weekly / biweekly のみ使用 */
  weekday?: number;
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
  updatedAt: number;
}

export interface WebDavConfig {
  serverUrl: string;
  path: string;
  username: string;
}

export interface SyncMeta {
  deviceId: string;
  lastSyncedAt: number | null;
  syncMode: "file" | "webdav" | null;
  webdav: WebDavConfig | null;
}

export interface SyncFile {
  schemaVersion: 1;
  exportedAt: number;
  deviceId: string;
  tasks: Task[];
  completions: Completions;
  prefs: Prefs;
}
