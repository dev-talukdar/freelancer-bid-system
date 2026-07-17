import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig(() => {
  return {
    plugins: [react()],
    test: {
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:4300' },
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['dist/**', 'node_modules/**', 'coverage/**'],
    },

    build: {
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'index.html'),
          sw: resolve(__dirname, 'src/background/service-worker.ts'),
          offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
  };
});
