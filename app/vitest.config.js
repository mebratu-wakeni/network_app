import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/setupTests.js'],
    include: ['tests/**/*.test.js'],
    fileParallelism: false,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
});
