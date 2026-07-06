/**
 * 通知の配信方法を決定する（仕様書 5.1・5.4）。
 *
 * Android/ChromeなどPWAインストール後のstandalone表示では、Service Worker管理下の
 * ページで `new Notification()` コンストラクタ自体が例外を投げ、通知が届かない
 * 既知の制約がある（要 `ServiceWorkerRegistration.showNotification()`）。
 * そのため、有効なSW registrationがあればそちらを優先し、
 * なければ従来通り `Notification` コンストラクタにフォールバックする。
 * どちらの経路でも判定・発火はアプリが開いている間のみ行われ、
 * Push APIによるバックグラウンド配信は行わない（5.4の方針を維持）。
 */
export async function deliverNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, { body });
      return;
    }
  }

  new Notification(title, { body });
}
