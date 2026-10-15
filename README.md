# gelengitech.com — site kaynağı

Astro ile üretilen statik site (TR kök, EN `/en/`). Cloudflare Pages'te yayınlanır.

- İçerik ve metinler: `src/content.ts` (tek dosya, TR/EN)
- Tasarım: `src/styles/global.css`
- Sayfa iskeleti: `src/components/Page.astro`, bölümler `src/components/Sections.astro`

Yerelde: `npm install && npm run dev` · Derleme: `npm run build` → `dist/`

Cloudflare Pages ayarları: build command `npm run build`, output directory `dist`.

## Kitaplığım (`/bookstore/`)

Kişisel kütüphane uygulaması `bookstore/` klasöründe: React SPA ve aynı Worker içinde `/bookstore/api/*` (Cloudflare D1). Kök `npm run build` her ikisini de derler. Kurulum ve API: [`bookstore/README.md`](bookstore/README.md).
