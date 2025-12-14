import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
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
