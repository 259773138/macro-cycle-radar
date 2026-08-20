import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base 使用相对路径：同时兼容 GitHub Pages 子路径（/macro-cycle-radar/）与本地预览
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '宏观周期雷达 Macro Cycle Radar',
        short_name: '周期雷达',
        description: '宏观周期感知工作台：数据自动采集、六层仪表盘、三档协议、预测日志与 AI 分析',
        theme_color: '#2563eb',
        background_color: '#f6f8fb',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,md}'],
        navigateFallback: './index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
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
