import type { Priority, Recurrence, Task } from "../types";

export interface NewTaskInput {
  title: string;
  detail?: string;
  priority?: Priority;
  category?: string;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  recurrence?: Recurrence;
}

/**
 * 新規タスクを仕様書4.2のデフォルト値で組み立てる。
 * クイック追加（タイトルのみ）・詳細フォームの両方から利用する。
 */
export function createTask(input: NewTaskInput): Task {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: input.title,
    detail: input.detail ?? "",
    priority: input.priority ?? "should",
    category: input.category ?? "",
    startDate: input.startDate ?? null,
    startTime: input.startTime ?? null,
    endDate: input.endDate ?? null,
    endTime: input.endTime ?? null,
    recurrence: input.recurrence ?? { type: "none" },
    completed: false,
    completedAt: null,
    marker: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    notifiedStart: false,
    notifiedEndSoon: false,
  };
}
