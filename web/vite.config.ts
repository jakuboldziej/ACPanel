import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const api = { target: `http://localhost:${env.PORT || "8090"}`, changeOrigin: false };
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": resolve(__dirname, "src") } },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          admin: resolve(__dirname, "admin/index.html"),
        },
      },
    },
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy: { "/api": api, "/admin/api": api },
    },
  };
});
