/// <reference types="vitest" />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

/**
 * vite-plugin-dts generates TypeScript declaration files (.d.ts) from our
 * TypeScript source during the build process. It:
 *
 * 1. Runs the TypeScript compiler to extract type information
 * 2. Generates .d.ts files for each source file
 * 3. With `rollupTypes: true`, bundles all declarations into a single index.d.ts
 *
 * This allows consumers to get full type support without us shipping source .ts files.
 */

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/__tests__/**/*'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'normalizr',
      formats: ['es', 'cjs'],
      fileName: (format) => `normalizr.${format === 'es' ? 'js' : 'cjs'}`,
    },
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    pool: 'vmThreads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'test/**', 'examples/**', 'docs/**'],
    },
  },
});
