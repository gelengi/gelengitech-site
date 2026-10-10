import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://gelengitech.com',
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },
  integrations: [sitemap()],
  i18n: {
    defaultLocale: 'tr',
    locales: ['tr', 'en'],
    routing: { prefixDefaultLocale: false },
  },
});
