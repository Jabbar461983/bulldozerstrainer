import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-32.png', 'favicon-48.png', 'logo-bulldozers_farbig.png', 'icons/*.png'],
      manifest: {
        name: 'Bulldozers Junioren Manager',
        short_name: 'Bulldozers',
        description: 'App zur Strukturierung der Juniorenabteilung des Streethockeyclub Bulldozers Kernenried-Zauggenried',
        theme_color: '#007057',
        background_color: '#007057',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            // Datenabfragen: immer möglichst aktuell, mit Offline-Fallback auf den letzten Stand.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Storage-Objekte (Fotos/Videos) werden über signierte URLs mit wechselndem
            // Token geladen; ignoreSearch sorgt dafür, dass dieselbe Datei trotzdem aus dem
            // Cache bedient wird, statt bei jedem neuen Token erneut heruntergeladen zu werden.
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              matchOptions: { ignoreSearch: true },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
