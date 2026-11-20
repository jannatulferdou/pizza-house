import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "API_");
  const apiOrigin =
    process.env.API_ORIGIN || env.API_ORIGIN || "http://127.0.0.1:3001";
  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": apiOrigin },
    },
    preview: { proxy: { "/api": apiOrigin } },
  };
});
