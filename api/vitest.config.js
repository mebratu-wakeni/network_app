import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/env.setup.js'],
    include: ['tests/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/modules/**/*.js', 'src/middleware/**/*.js'],
      exclude: ['src/index.js', 'src/server.js'],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30
      }
    }
  }
})
