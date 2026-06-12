// Sanitizador determinístico de "caguetes" de IA para as mensagens das Bias.
// Aplicado nos Code nodes de parse (pós-LLM, pré-envio WhatsApp): mesmo que o
// modelo desobedeça o bloco NATURALIDADE do prompt, o texto sai limpo.
// Regras conservadoras: não toca URLs, não toca hífens (" - " legítimo em
// listas/preços do simulador), não reescreve conteúdo — só pontuação-caguete.

export function repasseHumanizeMessage(text) {
  if (typeof text !== 'string') return text;
  // bullet de início de linha: "— item" → "- item" (no texto inteiro: travessão
  // em início de linha nunca faz parte de URL, e o split abaixo quebraria o ^)
  const bulleted = text.replace(/(^|\n)[ \t]*[—–][ \t]+/g, '$1- ');
  const parts = bulleted.split(/(https?:\/\/[^\s]+)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 1) continue; // índices ímpares são URLs (grupo de captura do split)
    let seg = parts[i];
    // faixa numérica: 9h—22h → 9h-22h (antes das regras de vírgula)
    seg = seg.replace(/(\d[a-z]?)[—–](\d)/gi, '$1-$2');
    // travessão com espaços antes de maiúscula → vira ponto
    seg = seg.replace(/[ \t]+[—–][ \t]+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ])/g, '. ');
    // travessão com espaços nos demais casos → vira vírgula
    seg = seg.replace(/[ \t]+[—–][ \t]+/g, ', ');
    // travessão colado entre palavras → vírgula
    seg = seg.replace(/([^\s])[—–](?=[^\s])/g, '$1, ');
    // ponto-e-vírgula → ponto (ninguém digita ; no WhatsApp)
    seg = seg.replace(/[ \t]*;[ \t]*(?=\S)/g, '. ');
    seg = seg.replace(/[ \t]*;/g, '.');
    parts[i] = seg;
  }
  let out = parts.join('');
  // exclamações: colapsa repetidas e mantém só a primeira da mensagem
  out = out.replace(/!{2,}/g, '!');
  let seenBang = false;
  out = out.replace(/!/g, () => {
    if (!seenBang) { seenBang = true; return '!'; }
    return '.';
  });
  // espaços duplicados criados pelas trocas (preserva \n)
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

export const HUMANIZER_MARKER_START = '// REPASSE HUMANIZER START';
export const HUMANIZER_MARKER_END = '// REPASSE HUMANIZER END';

// Bloco injetável nos Code nodes — gerado do próprio fonte para garantir paridade
// entre o que os testes cobrem e o que roda no n8n.
export const N8N_HUMANIZER_BLOCK = [
  HUMANIZER_MARKER_START,
  '// Sanitiza caguetes de IA na mensagem final (travessão, ponto-e-vírgula, excesso de exclamação).',
  '// Gerado de scripts/n8n/repasse-humanizer.mjs — edite lá e reaplique via apply-repasse-humanizer.mjs.',
  repasseHumanizeMessage.toString(),
  HUMANIZER_MARKER_END,
].join('\n');
