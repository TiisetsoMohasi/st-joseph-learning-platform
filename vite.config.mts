import { defineConfig } from "vite"

import react from "@vitejs/plugin-react"

import tailwindcss from "@tailwindcss/vite"

import path from "node:path"

import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiPort = process.env.API_PORT || process.env.PORT || "3000"

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    host: "0.0.0.0",

    port: 8443,

    strictPort: true,

    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,

        changeOrigin: true,
      },
    },
  },
})
