import { defineConfig } from 'vite';

// Serves and builds the demo app in demo/. The library itself is compiled
// separately with tsc (see tsconfig.build.json).
export default defineConfig({
  root: 'demo',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    open: true,
  },
});
