import { defineConfig } from 'vitest/config';

// Kept separate from vite.config so the app's root/publicDir settings never
// affect test discovery.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,ts}'],
  },
});
