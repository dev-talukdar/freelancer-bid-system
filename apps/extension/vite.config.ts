import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; import { resolve } from 'node:path';
export default defineConfig({ plugins:[react()], build:{ rollupOptions:{ input:{ popup:resolve(__dirname,'index.html'), sw:resolve(__dirname,'src/background/service-worker.ts'), offscreen:resolve(__dirname,'src/offscreen/offscreen.html')}, output:{entryFileNames:'[name].js'} } } });
