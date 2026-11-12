import { mount } from "svelte";
import "./lib/theme.css";
import App from "./App.svelte";

const target = document.getElementById("app");
if (!target) {
  throw new Error("#app element not found");
}

const app = mount(App, { target });

// PWA対応（仕様書9章）。単一ファイルビルドされた本番相当ビルドでのみ有効化する
// （`vite dev` では Service Worker のキャッシュがホットリロードの妨げになるため）。
// scope は /monolystar/ に絶対パス固定し、同 origin の別 PWA と衝突しないようにする
// （vite-plugin-singlefile が BASE_URL を "./" に変えうるためハードコードする）。
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/monolystar/sw.js", { scope: "/monolystar/" });
  });
}

export default app;
