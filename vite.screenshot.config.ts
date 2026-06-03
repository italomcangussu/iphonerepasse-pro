import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Screenshot-only build: renders the real <PDV/> with the context modules
// swapped for lightweight mocks (no Supabase/auth needed). RegExp aliases
// match whatever relative specifier each file uses to import the contexts.
export default defineConfig({
  root: '.',
  server: { port: 4399, host: '127.0.0.1', strictPort: true },
  plugins: [react()],
  resolve: {
    alias: [
      { find: /(^|.*\/)services\/dataContext$/, replacement: path.resolve(__dirname, 'screenshots/mocks/dataContext.tsx') },
      { find: /(^|.*\/)contexts\/AuthContext$/, replacement: path.resolve(__dirname, 'screenshots/mocks/AuthContext.tsx') },
      { find: /(^|.*\/)ui\/ToastProvider$/, replacement: path.resolve(__dirname, 'screenshots/mocks/ToastProvider.tsx') },
      { find: '@', replacement: path.resolve(__dirname, '.') },
    ],
  },
});
