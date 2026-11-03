import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Nest relies on decorator metadata, which esbuild does not emit.
  plugins: [swc.vite()],
  test: {
    // A Postgres container starts per test file.
    hookTimeout: 120_000,
  },
});
