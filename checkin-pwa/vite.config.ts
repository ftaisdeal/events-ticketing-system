import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/apple-touch-icon.png',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/pwa-maskable-512x512.png',
        'startup/apple-splash-*.png'
      ],
      manifest: {
        name: 'RDX Check-In',
        short_name: 'RDX Check-In',
        description: 'Staff-only scanner and check-in console for the RDX ticketing platform.',
        theme_color: '#111827',
        background_color: '#f4efe5',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/tickets/check-in/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'checkin-api',
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});