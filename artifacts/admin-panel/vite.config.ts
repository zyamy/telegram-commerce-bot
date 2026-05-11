import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const isDev = process.env.NODE_ENV !== "production";
const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig(async () => {
  // Replit-only dev plugins — loaded dynamically only when running inside Replit.
  // Railway / production builds do not need them.
  const replitPlugins = [];
  if (isDev && isReplit) {
    try {
      const runtimeErrorOverlay = (
        await import("@replit/vite-plugin-runtime-error-modal")
      ).default;
      const { cartographer } = await import("@replit/vite-plugin-cartographer");
      const { devBanner } = await import("@replit/vite-plugin-dev-banner");
      replitPlugins.push(
        runtimeErrorOverlay(),
        cartographer({ root: path.resolve(import.meta.dirname, "..") }),
        devBanner(),
      );
    } catch {
      // Replit plugins not installed — fine on Railway / other hosts.
    }
  }

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: process.env.API_PROXY_TARGET ?? "http://localhost:8080",
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
