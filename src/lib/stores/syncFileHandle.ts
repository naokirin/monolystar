import { writable } from "svelte/store";

/**
 * 同期ファイルの FileSystemFileHandle（仕様書 3.6）。
 * localStorage には保存できない（シリアライズ不可）ため、`persisted()` は使わず
 * セッション中のみ保持するプレーンな store とする。ページリロードで失われる。
 */
export const syncFileHandle = writable<FileSystemFileHandle | null>(null);
