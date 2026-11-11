import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// No celular quem rola o ERP é o documento (ver components/Layout.tsx).
// Qualquer regra que fixe ou corte a rolagem de <html>/<body> sem uma classe
// de estado mata a rolagem de todas as telas.
const DOCUMENT_SELECTORS = new Set([':root', 'html', 'body']);
const SCROLL_KILLERS = /(^|;)\s*(position\s*:\s*fixed|overflow(-y)?\s*:\s*hidden|touch-action\s*:\s*none)/;

const innermostRules = (css: string) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((selector) => selector.trim()),
    declarations: match[2],
  }));

describe('contrato de rolagem do documento', () => {
  it('nenhuma regra de :root, html ou body fixa a página ou esconde a rolagem', () => {
    const css = readFileSync(resolve(process.cwd(), 'index.css'), 'utf8');

    const offenders = innermostRules(css)
      .filter((rule) => rule.selectors.some((selector) => DOCUMENT_SELECTORS.has(selector)))
      .filter((rule) => SCROLL_KILLERS.test(rule.declarations))
      .map((rule) => rule.selectors.join(', '));

    expect(offenders).toEqual([]);
  });
});
