import { defineConfig } from "vitest/config";

// Unit tests for pure app logic only (no React Native rendering).
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
