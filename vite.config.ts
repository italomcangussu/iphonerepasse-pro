import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
        chunkSizeWarningLimit: 500, // Explicitly set to 500kB
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
