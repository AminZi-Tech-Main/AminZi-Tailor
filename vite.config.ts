import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// The service worker caches the app shell so the counter PC can open the
// app with no internet. Data lives in IndexedDB and syncs to Supabase.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AminZi Tailor',
        short_name: 'AminZi',
        description: 'Orders, measurements and stock for AminZi Fabrics & Tailors',
        theme_color: '#07080b',
        background_color: '#07080b',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // woff2 only: every browser that runs this app supports it, and it halves the offline cache.
        globPatterns: ['**/*.{js,css,html,svg,woff2,jpg,png}'],
        navigateFallback: '/index.html',
        // Never cache Supabase API traffic in the service worker; the app's own
        // outbox handles offline writes.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
      },
    }),
  ],
  server: { port: 5173 },
  build: {
    // Keep fonts as files (cached by the service worker) instead of base64 inside the CSS.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom'], supabase: ['@supabase/supabase-js'] } },
    },
  },
});
