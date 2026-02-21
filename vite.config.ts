import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      plugins: [
        nodePolyfills({ include: ['buffer', 'process', 'util', 'stream'] }),
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
          manifest: {
            name: 'Solana Raid',
            short_name: 'SR_PROTOCOL',
            description: 'Degen on-chain raiding game — extract or get busted.',
            theme_color: '#020202',
            background_color: '#020202',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            scope: '/',
            shortcuts: [
              { name: 'Quick Raid', short_name: 'Raid', description: 'Enter the lobby and deploy', url: '/?screen=raid', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
              { name: 'Leaderboard', short_name: 'Ranks', description: 'View the SR leaderboard', url: '/?screen=ranks', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
              { name: 'My Profile', short_name: 'Profile', description: 'View your profile and stats', url: '/?screen=profile', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
            ],
            icons: [
              {
                src: 'icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable',
              },
              {
                src: 'icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
              },
              {
                src: 'icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
              },
            ],
          },
          workbox: {
            skipWaiting: true,
            clientsClaim: true,
            // Exclude static legal pages from the SPA navigation fallback
            // so the SW doesn't serve index.html when users visit /privacy.html etc.
            navigateFallbackDenylist: [/^\/privacy\.html$/, /^\/terms\.html$/],
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            // Don't precache GLB models (too large, cache at runtime)
            globIgnores: ['**/*.glb'],
            // Raise limit to cover the large React+Three.js bundle
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
            runtimeCaching: [
              {
                urlPattern: /\.glb$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'glb-models',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
                },
              },
            ],
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      // Strip all console.* calls and debugger statements from production bundles
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
      },
      build: {
        // Warn at 1 MiB chunks (Three.js is large — expected)
        chunkSizeWarningLimit: 1024,
      },
    };
});
