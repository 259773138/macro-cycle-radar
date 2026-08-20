import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 使用相对路径：同时兼容 GitHub Pages 子路径（/macro-cycle-radar/）与本地预览
export default defineConfig({
  base: './',
  plugins: [react()],
  preview: {
    host: true,
    allowedHosts: true,
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
