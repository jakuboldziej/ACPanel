import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const apiPort = env.PORT || "8090";
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT || 5173),
      proxy: { "/api": { target: `http://localhost:${apiPort}`, changeOrigin: false } },
    },
  };
});
