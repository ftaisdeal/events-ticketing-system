import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/checkin-icon.svg', 'icons/checkin-maskable.svg'],
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
            src: 'icons/checkin-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'icons/checkin-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
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