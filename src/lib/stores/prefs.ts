import { persisted } from "./persist";
import type { Prefs } from "../types";

export const prefs = persisted<Prefs>("prefs-v1", {
  notif: false,
  updatedAt: 0,
});
