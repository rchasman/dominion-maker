import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nitro } from "nitro/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    nitro(),
  ],
  nitro: {
    serverDir: "./",
  },
})
