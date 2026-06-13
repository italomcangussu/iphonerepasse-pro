import assert from 'node:assert';
import {
  buildAllowedColors,
  buildCommerceContext,
  enforceAllowedColors,
  detectColors,
  buildCommerceContextRuntime,
} from './repasse-commerce-context.mjs';

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, `FAIL: ${name}`);
  console.log(`  ok - ${name}`);
  passed += 1;
}

// --- buildAllowedColors: union + dedupe across sources ---
{
  const allowed = buildAllowedColors({
    inventory: {
      available_colors: ['Preto', 'Azul'],
      available_colors_same_capacity: ['azul'], // dup (normalized)
      color_found: 'Verde',
      available_options: [{ color: 'Rosa' }, { color: 'Preto' }],
    },
    last_inventory_context: {
      available_colors: ['Amarelo'],
      available_options: [{ color: 'Azul' }],
    },
  });
  ok('union collects all stock colors', allowed.includes('Preto') && allowed.includes('Verde') && allowed.includes('Amarelo'));
  ok('dedupes by normalized form', allowed.filter((c) => c.toLowerCase() === 'azul').length === 1);
}

// --- buildCommerceContext: stable shape even when empty ---
{
  const ctx = buildCommerceContext({ memory: {} });
  ok('inventory_checked_this_turn false when no inventory', ctx.inventory_checked_this_turn === false);
  ok('inventory_found null when not checked', ctx.inventory_found === null);
  ok('allowed_colors empty array when no stock', Array.isArray(ctx.allowed_colors) && ctx.allowed_colors.length === 0);
  ok('stage defaults to collection', ctx.stage === 'collection');
}
{
  const ctx = buildCommerceContext({
    memory: { simulation_done: true, simulation_count: 2, last_simulation_total: 5200 },
    inventory: { inventory_found: true, color_found: 'Azul', available_colors: ['Azul', 'Preto'], best_item: { id: 'x' } },
  });
  ok('inventory_checked_this_turn true when inventory present', ctx.inventory_checked_this_turn === true);
  ok('allowed_colors populated from inventory', ctx.allowed_colors.includes('Azul') && ctx.allowed_colors.includes('Preto'));
  ok('stage = simulation when simulation_done', ctx.stage === 'simulation');
  ok('simulation snapshot carried', ctx.simulation.count === 2 && ctx.simulation.last_total === 5200);
}

// --- enforceAllowedColors: the reported #405587 bug ---
{
  const msg = 'Agora me diz: qual cor você prefere pro iPhone 15 — Meia-noite, Rosa, Azul-celeste ou Preto?';
  const res = enforceAllowedColors(msg, []); // no stock => no allowed colors
  ok('triggers when colors offered with empty allowed list', res.triggered === true);
  ok('detects multiple violating colors', res.violations.length >= 2);
  ok('safe fallback never enumerates a color', !/meia.?noite|azul.?celeste/i.test(res.message));
  ok('empty-allowed fallback asks for preference', /prefer/i.test(res.message));
}

// --- enforceAllowedColors: stock-backed colors pass; invalid ones get replaced ---
{
  const allowed = ['Azul', 'Preto'];
  const good = enforceAllowedColors('Temos em Azul e Preto, qual te atende?', allowed);
  ok('passes through when all colors are stock-backed', good.triggered === false && /Azul/.test(good.message));

  const bad = enforceAllowedColors('Temos em Azul, Preto e Verde-alpino.', allowed);
  ok('triggers when one offered color is not in stock', bad.triggered === true && bad.violations.length === 1);
  ok('replacement lists only allowed colors', /Azul, Preto/.test(bad.message) && !/alpino/i.test(bad.message));
}

// --- enforceAllowedColors: no color mentioned => untouched ---
{
  const msg = 'Perfeito! Você prefere retirar em Fortaleza ou Sobral?';
  const res = enforceAllowedColors(msg, []);
  ok('no-op when message mentions no color', res.triggered === false && res.message === msg);
}

// --- multiword precedence: "azul profundo" not double-counted as "azul" ---
{
  const res = enforceAllowedColors('Tenho em Azul profundo.', ['Azul profundo']);
  ok('multiword color treated as single allowed token', res.triggered === false);
  const res2 = enforceAllowedColors('Tenho em Azul profundo.', ['Azul']);
  ok('multiword violation detected vs different allowed token', res2.triggered === true);
}

// --- accent stripping works (normalizeText via the public surface) ---
{
  const res = enforceAllowedColors('Cor: Grafite.', ['grafite']);
  ok('accent/case-insensitive match (Grafite vs grafite)', res.triggered === false);
}

// --- customer-echo allowlist (regression: exec #405566) ---
{
  // Agent echoes the color the customer asked for, no stock checked.
  const msg = 'Ótimo, vi que você quer o iPhone 13 Pro Max 256GB rosa! Você prefere retirar em Fortaleza ou Sobral?';
  const withoutEcho = enforceAllowedColors(msg, []);
  ok('without echo allowlist, customer-color echo would trigger', withoutEcho.triggered === true);
  const withEcho = enforceAllowedColors(msg, [], ['rosa']);
  ok('echoing the customer color does NOT trigger', withEcho.triggered === false && withEcho.message === msg);
}
{
  // #405587 must STILL be caught even though customer mentioned "azul" (trade-in).
  const msg = 'Agora me diz: qual cor pro iPhone 15 — Meia-noite, Rosa, Azul-celeste ou Preto?';
  const res = enforceAllowedColors(msg, [], ['azul']); // customer said azul (trade-in)
  ok('#405587 still caught despite customer azul echo', res.triggered === true && res.violations.length >= 3);
}
{
  // detectColors is exported and finds tokens for the node to build echo list.
  const found = detectColors('quero um iPhone 15 rosa ou azul');
  ok('detectColors exported & finds customer colors', found.includes('rosa') && found.includes('azul'));
}

// --- runtime string embeds the functions ---
{
  const rt = buildCommerceContextRuntime();
  ok('runtime string contains markers', rt.includes('REPASSE COMMERCE CONTEXT START') && rt.includes('enforceAllowedColors'));
}

console.log(`\nrepasse-commerce-context: ${passed} assertions passed`);
