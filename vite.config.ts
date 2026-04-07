import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://100.106.39.43:4533";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 6666,
      proxy: {
        "/rest": {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});
