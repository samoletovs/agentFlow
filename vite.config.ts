import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-public-view",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.method === "GET" && request.url?.split("?")[0] === "/.auth/me") {
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ clientPrincipal: null }));
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5173 },
  build: { sourcemap: true, target: "es2022" },
});
