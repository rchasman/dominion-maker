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
            if (id.includes("trystero")) {
              return "multiplayer-vendor";
            }
            if (id.includes("@floating-ui")) {
              return "ui-vendor";
            }
            return "vendor";
          }
          if (
            id.includes("/engine/") ||
            id.includes("/commands/") ||
            id.includes("/cards/") ||
            id.includes("/data/cards")
          ) {
            return "game";
          }
          return;
        },
      },
    },
  },
});
