import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
  ],
  define: {
    'import.meta.env.VITE_VERCEL_URL': JSON.stringify(process.env.VERCEL_URL),
  },
})
