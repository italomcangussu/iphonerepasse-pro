import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    // Os includes são `**/…`, então casam em qualquer profundidade — os excludes
    // precisam ser igualmente livres de âncora. Ancorados na raiz, uma cópia do
    // repo dentro de uma git worktree (`.claude/worktrees/<nome>/…`, criada pelas
    // tarefas em background) reintroduzia todos os testes duplicados, incluindo
    // os de edge function em Deno — que quebram na coleta sob o Vitest.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/.claude/worktrees/**',
      '**/supabase/functions/**'
    ],
    testTimeout: 15000,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key'
    }
  }
});
