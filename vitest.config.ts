import { defineConfig } from 'vitest/config';

// Keep package verification identical in this monorepo and the public mirror.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
