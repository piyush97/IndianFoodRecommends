import { defineConfig } from "vitest/config";

// DB tests truncate shared tables, so test files must not run in parallel.
export default defineConfig({
  test: { fileParallelism: false },
});
