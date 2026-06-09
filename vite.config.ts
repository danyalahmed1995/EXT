/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const excludeDocsDemoAssets = () => ({
  name: "exclude-docs-demo-assets",
  apply: "build" as const,
  closeBundle: async () => {
    await rm(resolve("dist", "demo-example"), { recursive: true, force: true });
    await rm(resolve("dist", "tauri.svg"), { force: true });
    await rm(resolve("dist", "vite.svg"), { force: true });
  },
});

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), excludeDocsDemoAssets()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}));
