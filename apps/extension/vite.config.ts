import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, '');
  const localApiSecret = env.VITE_LOCAL_API_SECRET ?? env.LOCAL_API_SECRET ?? '';
  const apiBaseUrl = env.VITE_API_BASE_URL ?? 'https://api.enaema.net';

  return {
    envDir: repositoryRoot,
    plugins: [react()],
    define: {
      'import.meta.env.VITE_LOCAL_API_SECRET': JSON.stringify(localApiSecret),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },

    test: {
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
