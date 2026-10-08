import { defineConfig } from "vitest/config";

// Served from https://appleseed090.github.io/acid-road/, so every asset URL needs the repo name as its prefix.
export default defineConfig({
  base: "/acid-road/",
  build: { target: "es2022" },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
