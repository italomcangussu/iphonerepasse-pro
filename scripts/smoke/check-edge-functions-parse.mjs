/**
 * Portão de sintaxe para as edge functions (supabase/functions/**).
 *
 * Motivação: essas pastas estão fora do tsconfig, do ESLint e do Vitest, e o
 * `test:deno` só alcança arquivos que contêm `Deno.test`. Sem este script um
 * arquivo com erro de sintaxe passa por toda a suíte verde e só quebra no
 * `supabase functions deploy` (aconteceu em a7a7366 com send-receipt-whatsapp).
 *
 * Escopo deliberadamente estreito: apenas *parse*. Um `deno check` completo
 * acusa ~40 erros de tipo pré-existentes (genéricos do SupabaseClient) e
 * nasceria vermelho — um portão que ninguém consegue manter verde é ignorado.
 */
import { globSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const files = globSync('supabase/functions/**/*.ts', {
  exclude: (p) => p.includes('/node_modules/')
}).sort();

let failed = 0;

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.ESNext,
    /* setParentNodes */ false,
    ts.ScriptKind.TS
  );

  // `parseDiagnostics` é interno mas estável desde o TS 2.x; é a única forma de
  // obter diagnósticos sintáticos sem montar um Program (que traria erros de tipo).
  const diagnostics = source.parseDiagnostics ?? [];
  if (diagnostics.length === 0) continue;

  failed += 1;
  for (const d of diagnostics) {
    const { line, character } = source.getLineAndCharacterOfPosition(d.start);
    const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
    console.error(`${file}:${line + 1}:${character + 1} — ${message}`);
  }
}

if (failed > 0) {
  console.error(`\n✗ ${failed} arquivo(s) de edge function não parseiam.`);
  process.exit(1);
}

console.log(`✓ ${files.length} arquivos de edge function parseiam.`);
