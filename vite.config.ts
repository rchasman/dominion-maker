import { createLogger, defineConfig } from "vite";
import { analyzer } from "vite-bundle-analyzer";

const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
  if (msg.includes("PLUGIN_TIMINGS")) return;
  originalWarn(msg, options);
};

// https://vite.dev/config/
export default defineConfig({
  customLogger: logger,
  plugins: [process.env.ANALYZE && analyzer()],
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "preact",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  define: {
    "import.meta.env.VITE_VERCEL_URL": JSON.stringify(process.env.VERCEL_URL),
  },
  build: {
    target: "es2022",
    minify: "oxc",
    sourcemap: !!process.env.CI,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("preact")) {
              return "preact-vendor";
            }
            // Split vendor by usage pattern
            if (id.includes("partysocket")) {
              return "multiplayer-vendor";
            }
            if (id.includes("@floating-ui")) {
              return "ui-vendor";
            }
            return "vendor";
          }

          // Extract image optimization to shared chunk (used everywhere)
          if (
            id.includes("/lib/image-optimization") ||
            id.includes("/lib/image-preload")
          ) {
            return "image-utils";
          }

          // Tooltips as separate chunks (lazy-loaded on hover)
          if (id.includes("CardTooltip") || id.includes("PileTooltip")) {
            return "tooltips";
          }

          // Game runtime: entire game system (engine + AI + state)
          // Includes engine, commands, cards, strategies, consensus, GameContext
          if (
            id.includes("/engine/") ||
            id.includes("/commands/") ||
            id.includes("/cards/") ||
            id.includes("/data/cards") ||
            id.includes("/agent/") ||
            id.includes("/strategies/") ||
            id.includes("use-ai-automation") ||
            id.includes("GameContext")
          ) {
            return "game-runtime";
          }
          return;
        },
      },
    },
  },
});
