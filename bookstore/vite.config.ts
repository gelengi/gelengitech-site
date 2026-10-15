import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Uygulama gelengitech.com/bookstore/ altında yayınlanır.
// Derleme çıktısı Astro sitesinin dist klasörüne yazılır (../dist/bookstore).
export default defineConfig({
  base: '/bookstore/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist/bookstore',
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
});
