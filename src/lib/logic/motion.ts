/**
 * モーション関連のユーティリティ。
 *
 * CSSの `@media (prefers-reduced-motion: reduce)` では表現できない
 * JS駆動アニメーション（Svelteの animate:flip の duration 等）のために、
 * ユーザーの「視差効果を減らす」設定を実行時に参照する。
 */

/**
 * ユーザーが「視差効果を減らす（prefers-reduced-motion: reduce）」を
 * 有効にしているかを返す。`matchMedia` が使えない環境では false を返す。
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
