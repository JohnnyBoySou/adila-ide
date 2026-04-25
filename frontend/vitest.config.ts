import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    benchmark: {
      include: ["src/**/*.bench.ts", "src/**/*.bench.tsx"],
      outputJson: ".vitest-bench.json",
    },
  },
});
