import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    reporters: ['default'],
  },
});