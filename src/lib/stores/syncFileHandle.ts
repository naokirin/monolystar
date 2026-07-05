import { writable } from "svelte/store";

/**
 * 同期ファイルの FileSystemFileHandle（仕様書 3.6 / 8.3.2）。
 *
 * ハンドルは localStorage には保存できない（JSON シリアライズ不可）が、
 * IndexedDB には structured clone でそのまま保存できる。仕様書 8.3.2 の
 * 「再訪問時は requestPermission で再承認を求める」を満たすため、ここでは
 * IndexedDB にハンドルを永続化し、リロード後も同じファイルを復元する。
 * 権限自体はセッション単位のため、復元後の初回同期で再承認を求める。
 */

const DB_NAME = "monolystar-sync";
const STORE_NAME = "handles";
const HANDLE_KEY = "syncFile";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(handle: FileSystemFileHandle | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (handle) {
        store.put(handle, HANDLE_KEY);
      } else {
        store.delete(HANDLE_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function loadHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const syncFileHandle = writable<FileSystemFileHandle | null>(null);

// 初期ロード完了までは subscribe からの書き戻しを抑止する
// （復元した値を IndexedDB に書き戻す無駄・初期 null での削除を防ぐ）。
let ready = false;

syncFileHandle.subscribe((handle) => {
  if (!ready) return;
  void saveHandle(handle).catch(() => {
    // 永続化に失敗しても同期自体は継続できるため握りつぶす
  });
});

/**
 * IndexedDB から保存済みハンドルを復元する Promise。
 * App 起動時に await し、復元できたら store へセットする。
 */
export const syncFileHandleReady: Promise<void> = loadHandle()
  .then((handle) => {
    if (handle) syncFileHandle.set(handle);
  })
  .catch(() => {
    // 復元に失敗した場合は未設定のまま（手動で再選択できる）
  })
  .finally(() => {
    ready = true;
  });
