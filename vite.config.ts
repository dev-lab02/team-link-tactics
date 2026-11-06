import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/team-link-tactics/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192.png', 'pwa-512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/team-link-tactics/',
        name: 'TEAM LINK 戦術ボード',
        short_name: '戦術ボード',
        description: 'バスケットボールの戦術ボード',
        start_url: '/team-link-tactics/',
        scope: '/team-link-tactics/',
        display: 'standalone',
        background_color: '#0d1728',
        theme_color: '#0d1728',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
    }),
  ],
})
