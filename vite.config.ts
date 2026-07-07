import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { chunkBudgetPlugin, VITE_CHUNK_WARNING_LIMIT_KB } from './utils/chunkBudget';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: [
          'localhost',
          'app.iphonerepasse.com.br',
          'crm.iphonerepasse.com.br',
          'www.iphonerepasse.com.br',
          'iphonerepasse.com.br',
          'stc-iphonerepasse.ylgf5w.easypanel.host'
        ],
      },
      plugins: [
        react(),
        chunkBudgetPlugin(),
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'public',
          filename: 'sw.js',
          injectRegister: false,
          manifest: false,
          injectManifest: {
            injectionPoint: undefined,
            maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          },
          devOptions: {
            enabled: false,
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
      build: {
        // Vite accepts only one global warning threshold. The chunk-budget plugin
        // keeps 500 kB for normal chunks and grants 1,400 kB only to lazy heic2any.
        chunkSizeWarningLimit: VITE_CHUNK_WARNING_LIMIT_KB,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-icons': ['lucide-react'],
              'vendor-charts': ['recharts'],
              'vendor-motion': ['framer-motion'],
              'vendor-html2canvas': ['html2canvas'],
              'vendor-jspdf': ['jspdf'],
              'vendor-utils': ['axios', '@supabase/supabase-js']
            }
          }
        }
      }
    };
});
