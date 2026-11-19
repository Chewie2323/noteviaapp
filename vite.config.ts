import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// npm run build       -> Netlify build (dist/) with PWA service worker
// npm run build:demo  -> one self-contained HTML file (dist-demo/index.html) in demo mode
export default defineConfig(({ mode }) => {
  const single = mode === 'singlefile';
  return {
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    plugins: [
      react(),
      ...(single ? [viteSingleFile()] : [VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['brand/icon-32.png', 'brand/icon-192.png', 'brand/icon-512.png'],
        manifest: {
          name: 'Notevia', short_name: 'Notevia', description: 'One space. Endless learning.',
          theme_color: '#7C6FD1', background_color: '#F8F6FC', display: 'standalone', start_url: '/',
          icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
        },
        workbox: { maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, navigateFallback: '/index.html' },
      })]),
    ],
    build: single
      ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 30000 }
      : { outDir: 'dist', chunkSizeWarningLimit: 3000 },
    define: single ? { 'import.meta.env.VITE_HASH_ROUTER': '"true"', 'import.meta.env.VITE_FORCE_DEMO': '"true"' } : {},
  };
});
