import { defineConfig } from "vite";
export default defineConfig({
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 5188,
    strictPort: true,
    watch: { usePolling: true, interval: 400, ignored: ["**/backend/**"] },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        timeout: 1800000,
        proxyTimeout: 1800000,
      },
    },
  },
});
