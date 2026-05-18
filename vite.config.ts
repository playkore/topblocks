import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
  test: {
    environment: "node",
  },
});
