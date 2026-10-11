import { defineConfig } from 'vitest/config';

// Pure unit tests (reducers + routing logic) run in a node environment — no DOM needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
