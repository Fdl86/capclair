import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'CAP CLAIR - Navigation VFR',
        short_name: 'CAP CLAIR',
        description: 'PWA de navigation VFR : planification, suivi GPS navigateur, traces locales, import GPX et Replay synchronisé.',
        theme_color: '#050B12',
        background_color: '#050B12',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['**/airspaceCatalog-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/airspaceCatalog-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capclair-airspace-catalog',
              expiration: { maxEntries: 3, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900
  }
});
