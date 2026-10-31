import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const directory = path.dirname(fileURLToPath(import.meta.url));

// Independent Vite entry, deliberately outside the React Router app routes.
export default defineConfig({
  root: directory,
  plugins: [tailwindcss()],
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(directory, "../../app") } },
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
});
