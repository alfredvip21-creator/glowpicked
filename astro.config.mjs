import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://glowpicked.com',
  integrations: [
    sitemap()
  ],
  output: 'static',
  adapter: netlify(),
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  }
});