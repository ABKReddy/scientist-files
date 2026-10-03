import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Component tests run in jsdom against the real app (no network, canvas stubbed).
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  })
);