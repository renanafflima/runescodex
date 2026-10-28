import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const WEB_BASE_PATH = "/runescodex/";

export default defineConfig({
  base: WEB_BASE_PATH,
  plugins: [
    react(),
    VitePWA({
      // There is no update prompt in the app. Letting a new worker wait kept
      // clients on stale API code after a successful production deploy.
      registerType: "autoUpdate",
      injectRegister: "script",
      scope: WEB_BASE_PATH,
      includeAssets: ["icons/*.svg"],
      manifest: {
        id: WEB_BASE_PATH,
        name: "RuneCodex",
        short_name: "RuneCodex",
        description: "RuneCodex Web/PWA",
        lang: "pt-BR",
        start_url: WEB_BASE_PATH,
        scope: WEB_BASE_PATH,
        display: "standalone",
        orientation: "any",
        theme_color: "#070b14",
        background_color: "#070b14",
        icons: [
          {
            src: "icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/maskable-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,ico,woff2}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: `${WEB_BASE_PATH}index.html`,
        navigateFallbackAllowlist: [/^\/runescodex(?:\/.*)?$/],
        navigateFallbackDenylist: [/^\/runescodex\/api(?:\/|$)/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
