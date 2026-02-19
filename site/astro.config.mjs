import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://glowpicked.com',
  integrations: [
    // sitemap() // TODO: fix sitemap plugin compatibility
  ],
  output: 'static',
  adapter: netlify(),
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto'
  }
});