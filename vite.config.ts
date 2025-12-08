import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
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
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
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
        },
      },
    },
  },
});
