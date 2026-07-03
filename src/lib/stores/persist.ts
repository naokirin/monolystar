import { writable, type Writable } from "svelte/store";

/**
 * localStorage の指定キーと同期する writable store を作成する。
 * 読み込み時の JSON パース失敗・値の欠落時は defaultValue にフォールバックする。
 */
export function persisted<T>(key: string, defaultValue: T): Writable<T> {
  const initial = readInitial(key, defaultValue);
  const store = writable<T>(initial);

  store.subscribe((value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage が使えない環境（プライベートブラウジング等）では永続化を諦める
    }
  });

  return store;
}

function readInitial<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}
