import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      // Import the source for instant HMR. Published packages still resolve to dist.
      "@wicklib/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@wicklib/script-editor": fileURLToPath(
        new URL("../../packages/script-editor/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        editor: fileURLToPath(new URL("./editor.html", import.meta.url)),
      },
    },
  },
});
