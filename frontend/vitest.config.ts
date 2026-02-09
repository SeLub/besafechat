import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(path.dirname(new URL('.', import.meta.url).pathname), './app'),
    },
  },
});
