import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { UNUSED_ASSET_GLOBS } from './scripts/unused-assets.mjs';

export default defineConfig({
  // Caminhos relativos: o build funciona em qualquer subpasta (GitHub Pages, Cloudflare, servidor local).
  base: './',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Folha de Produção Diária',
        short_name: 'Produção',
        description: 'Registro das OSs do turno e Espelho de Campo em PDF, funciona sem internet.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#06141c',
        background_color: '#06141c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Fontes de outros alfabetos e dependências opcionais do jsPDF: o app nunca carrega (~465 KB).
        globIgnores: UNUSED_ASSET_GLOBS,
      },
    }),
  ],
});
