import { writable, type Readable, type Writable } from "svelte/store";

/**
 * 永続化（localStorage への書き込み）に失敗したことを UI に通知するためのストア。
 * 値が変わったら App 側でトースト表示する。連続失敗でトーストがスパムにならないよう、
 * 前回通知から一定時間（下記スロットル）以内の失敗は再セットしない。
 */
export interface PersistErrorInfo {
  key: string;
  at: number;
}

const persistErrorStore = writable<PersistErrorInfo | null>(null);
export const persistError: Readable<PersistErrorInfo | null> = persistErrorStore;

/** 永続化失敗トーストの再通知を抑制するスロットル間隔（ミリ秒）。 */
const PERSIST_ERROR_THROTTLE_MS = 60_000;
let lastPersistErrorAt = 0;

function reportPersistError(key: string): void {
  const now = Date.now();
  // 前回通知から一定時間以内の失敗は再セットしない（トーストのスパム防止）。
  if (now - lastPersistErrorAt < PERSIST_ERROR_THROTTLE_MS) return;
  lastPersistErrorAt = now;
  persistErrorStore.set({ key, at: now });
}

/**
 * localStorage の指定キーと同期する writable store を作成する。
 * 読み込み時に JSON パース失敗または `validate` による型検証失敗を検知した場合は、
 * 元の生文字列を `${key}.corrupt` へ退避してから defaultValue にフォールバックする。
 * 書き込みに失敗した場合は `persistError` ストアに記録し、UI が気づけるようにする。
 * 他タブ/PWAウィンドウによる同一キーの書き込みは storage イベントで反映し、
 * タブ間で変更が後勝ちで消えないようにする。
 */
export function persisted<T>(
  key: string,
  defaultValue: T,
  validate: (v: unknown) => v is T,
): Writable<T> {
  const initial = readInitial(key, defaultValue, validate);
  const store = writable<T>(initial);

  // 直近に localStorage へ書いた／storage イベントで受け取った JSON 文字列。
  // storage イベントで受け取った値を subscribe がそのまま setItem し直す無駄を省く。
  let lastRaw: string | null = null;

  store.subscribe((value) => {
    const raw = JSON.stringify(value);
    if (raw === lastRaw) return;
    try {
      localStorage.setItem(key, raw);
      lastRaw = raw;
    } catch {
      // localStorage が使えない環境（プライベートブラウジング等）や、容量超過
      // （QuotaExceededError）で書き込めない場合。従来は無言で握りつぶしていたが、
      // ユーザーが永続化失敗に気づけるよう通知ストアへ記録する。
      reportPersistError(key);
    }
  });

  // 他タブ/PWAウィンドウが同一キーへ書き込んだ変更を storage イベントで反映する。
  // storage イベントは書き込み元のタブでは発火しないため、エコーループは発生しない。
  // window が無い環境（テストランナー等）では購読しない。ストアはアプリと同寿命の
  // シングルトンなのでリスナーの解除は不要。
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      // キー削除（newValue === null）はこのアプリでは行わないため無視する。
      if (event.newValue === null) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.newValue);
      } catch {
        // 他タブ側の書き込みが不正でも、こちらのデータを壊す操作ではないため
        // 反映せず無視する（.corrupt への退避もしない）。
        return;
      }
      if (!validate(parsed)) return;

      lastRaw = event.newValue;
      store.set(parsed);
    });
  }

  return store;
}

function readInitial<T>(
  key: string,
  defaultValue: T,
  validate: (v: unknown) => v is T,
): T {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // localStorage 自体が使えない環境では読み込みを諦めて defaultValue を使う。
    return defaultValue;
  }
  if (raw === null) return defaultValue;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON として壊れているデータは復旧できないよう消さず、退避してからフォールバックする。
    quarantineCorrupt(key, raw);
    return defaultValue;
  }

  if (!validate(parsed)) {
    // 形状が不正なデータも同様に退避する（誤った上書きでの復旧不能を防ぐ）。
    quarantineCorrupt(key, raw);
    return defaultValue;
  }

  return parsed;
}

/**
 * 壊れた生文字列を `${key}.corrupt` に退避する。defaultValue を書き戻す前に呼ぶことで、
 * 破損データが復旧不能なまま消えるのを防ぐ。退避の setItem 自体が失敗しても無視する。
 */
function quarantineCorrupt(key: string, raw: string): void {
  const corruptKey = `${key}.corrupt`;
  console.warn(`${key} の永続データが不正なため ${corruptKey} へ退避しました`);
  try {
    localStorage.setItem(corruptKey, raw);
  } catch {
    // 退避先への書き込みが失敗しても（容量超過等）フォールバックは続行する。
  }
}
