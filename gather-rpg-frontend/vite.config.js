/* eslint-disable */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    // host: '0.0.0.0', // Listen on all network interfaces (EC2/Production)
    host: '127.0.0.1', // Local development (Force IPv4 to prevent Web Speech API IPv6/localhost resolution issues)
    port: 5173,
    proxy: {
      '/api': {
        // target: 'http://18.221.199.221:3000', // Production (EC2)
        target: 'http://127.0.0.1:3000', // Local development
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[ViteProxy] error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[ViteProxy] sending request to:', req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[ViteProxy] received response:', proxyRes.statusCode, req.url);
          });
        }
      },
      '/ws': {
        // target: 'ws://18.221.199.221:3000', // Production (EC2)
        target: 'ws://127.0.0.1:3000', // Local development
        ws: true,
        changeOrigin: true,
        secure: false
      },
      '/voice': {
        // target: 'http://18.221.199.221:8000', // Production (EC2)
        target: 'http://127.0.0.1:8000', // Local development
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/voice/, '')
      }
    }
  },
  plugins: [
    react()
  ],
  define: {
    'process.env': {},
    global: 'window',
  },
  resolve: {
    alias: {
      process: 'process/browser',
      stream: 'stream-browserify',
      zlib: 'browserify-zlib',
      util: 'util',
      events: 'events',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
    include: ['simple-peer', 'util', 'events'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: true,
  },
})
