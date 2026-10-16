import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Web: gelengitech.com/bookstore/ altında yayınlanır, çıktı Astro sitesinin dist klasörüne yazılır (../dist/bookstore).
// Mobil (`vite build --mode mobile`): Capacitor uygulaması dosyaları yerelden yükler → göreli yollar, çıktı dist-mobile.
export default defineConfig(({ mode }) => ({
  base: mode === 'mobile' ? './' : '/bookstore/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: mode === 'mobile' ? 'dist-mobile' : '../dist/bookstore',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    proxy: {
      // Yerel geliştirmede API'yi `npm run dev:api` (wrangler dev, yerel D1) karşılar
      '/bookstore/api': 'http://localhost:8787',
    },
  },
}));
