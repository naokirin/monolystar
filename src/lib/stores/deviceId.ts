import { persisted } from "./persist";

/**
 * 端末識別子。書き出しファイル（SyncFile）の `deviceId` に記録し、
 * インポート時に「自端末が書き出したファイル」かどうかの判定（仕様書8.5の
 * 競合検出で、自端末ファイルとの差分を競合候補としてカウントしない）に使う。
 * この判定を成立させるため、セッションごとの再生成ではなく永続化する。
 */
export const deviceId = persisted<string>(
  "device-id-v1",
  crypto.randomUUID(),
  (v): v is string => typeof v === "string" && v.length > 0,
);
