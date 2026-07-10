import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        sw: resolve(__dirname, 'src/background/service-worker.ts'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.html'),
      },
      output: { entryFileNames: '[name].js' },
    },
  },
});
