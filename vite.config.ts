import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CAP CLAIR - Navigation VFR',
        short_name: 'CAP CLAIR',
        description: 'PWA de navigation VFR : planification, couche SUP AIP AUTO BETA, import local NOTAM et PIB SOFIA BETA, log de nav PDF, suivi GPS, traces et Replay.',
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
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,pdf,json,geojson,webmanifest}'],
        globIgnores: [
          '**/airspaceCatalog-*.js',
          '**/TraceReplayScreen-*.js',
          '**/TraceReplayScreen-*.css',
          '**/pdf-engine-*.js',
          '**/pdf.worker.min-*.mjs',
          '**/data/supaip-current.geojson',
          '**/data/supaip-status.json',
          '**/data/supaip-unmapped.json',
          '**/data/supaip-manifest.json'
        ],
        runtimeCaching: [
          {
            urlPattern: /\/data\/supaip-(?:current\.geojson|status\.json|unmapped\.json|manifest\.json)(?:\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'capclair-supaip-live-data',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/assets\/airspaceCatalog-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capclair-airspace-catalog',
              expiration: { maxEntries: 3, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/assets\/TraceReplayScreen-.*\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capclair-replay',
              expiration: { maxEntries: 6, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/assets\/pdf-engine-.*\.js$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capclair-pdf-engine',
              expiration: { maxEntries: 3, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /\/assets\/pdf\.worker\.min-.*\.mjs$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'capclair-pdf-worker',
              expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/pdf-lib/')) return 'pdf-engine';
          return undefined;
        }
      }
    }
  }
});
