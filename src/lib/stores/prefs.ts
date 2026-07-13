import { persisted } from "./persist";
import type { Prefs } from "../types";

/** 「今日」タブの締切先送り閾値（日数）の既定値。仕様書4.5参照。 */
export const DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS = 7;

export const prefs = persisted<Prefs>("prefs-v1", {
  notif: false,
  farDeadlineThresholdDays: DEFAULT_FAR_DEADLINE_THRESHOLD_DAYS,
  updatedAt: 0,
});
