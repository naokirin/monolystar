import { persisted } from "./persist";
import type { SyncMeta } from "../types";

function createDefaultSyncMeta(): SyncMeta {
  return {
    deviceId: crypto.randomUUID(),
    lastSyncedAt: null,
    syncMode: null,
    webdav: null,
  };
}

export const syncMeta = persisted<SyncMeta>("sync-meta-v1", createDefaultSyncMeta());
