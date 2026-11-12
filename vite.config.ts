import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

// 「データは端末から出ない」という本アプリの約束を技術的にも保証するため、
// Google Fonts CDN（docs/todo-app-spec.md 9.2）以外への外部通信をCSPで遮断する。
// index.html に直接書くと `vite dev` のHMR（WebSocket接続・モジュール配信）が
// 壊れるため、本番ビルド時のみ transformIndexHtml で注入する。
// order: "post" により viteSingleFile によるインライン化後の最終HTMLに対して効かせる。
const CSP_CONTENT = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "worker-src 'self'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function injectCsp(): Plugin {
  return {
    name: "inject-csp-meta",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const metaTag = `<meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}">`;
        return html.replace(/<head>/, `<head>\n    ${metaTag}`);
      },
    },
  };
}

// GitHub Pages のプロジェクトサイト（https://naokirin.github.io/monolystar/）向け。
// 同 origin 上の別 PWA と WebAPK が衝突しないよう、アセット経路を /monolystar/ に固定する。
// vite-plugin-singlefile の推奨設定は base を "./" に上書きするため、overrideConfig で戻す。
const APP_BASE = "/monolystar/";

export default defineConfig(({ mode }) => ({
  base: APP_BASE,
  plugins: [
    svelte(),
    ...(mode === "production"
      ? [viteSingleFile({ overrideConfig: { base: APP_BASE } }), injectCsp()]
      : []),
  ],
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
}));
