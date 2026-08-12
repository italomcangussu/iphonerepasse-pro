# Erro grave ao imprimir recibo — investigação e análise de troca do motor de impressão

**Data:** 2026-08-12
**Evidência:** PDF gerado pelo usuário (`iPhoneRepasse_Pro.pdf`) ao imprimir um comprovante de venda.

---

## 1. Resumo executivo

Imprimir o comprovante a partir do iPhone produz **uma folha A4 contendo apenas o menu do
aplicativo** (`iPhoneRepasse · Dashboard · PDV · Estoque · Financeiro · Mais`), **sem nenhum
dado do recibo**. O cliente recebe uma folha inútil.

A causa não é o conteúdo do recibo — o template está correto. A causa é o **motor de
impressão**: ele revela o recibo mutando estado global e temporário do documento
(`document.body[data-print-layout]` + uma tag `<style media="print">` injetada) e **desfaz
essa mutação no evento `afterprint`**. No WebKit/iOS, `window.print()` **não bloqueia** e a
página só é rasterizada **depois** de `afterprint` — ou seja, o recibo já foi escondido
novamente quando o PDF é desenhado. O mesmo acontece em qualquer impressão iniciada pelo
usuário (⌘P, Compartilhar → Imprimir), porque nesse caminho o JS do app nunca roda.

O motor atual é estruturalmente frágil: **o documento impresso é o próprio app**. Recomenda-se
um hotfix imediato e, na sequência, a troca do motor para **geração de PDF determinística**.

---

## 2. Evidência: o que o PDF anexado prova

Metadados extraídos do arquivo:

| Campo | Valor |
|---|---|
| `/Creator` | `Safari` |
| `/Producer` | `iOS Version 26.6 (Build 23G71) Quartz PDFContext` |
| `/Title` | `iPhoneRepasse Pro` |
| `/CreationDate` | `2026-08-12 16:00:49Z` |
| MediaBox | `595.28 × 841.89 pt` (A4) |
| Páginas | 1 |

Texto extraível da única página, na íntegra:

```
iPhoneRepasse
Dashboard PDV Estoque Financeiro Mais
https://app.iphonerepasse.com.br/?source=pwa#/pdv     12/08/2026, 13:00
Página 1 de 1
```

Três conclusões diretas:

1. **Plataforma:** Safari no iOS 26.6. A linha da URL/data/página é o cabeçalho-rodapé nativo
   do Safari, não do app.
2. **Contexto PWA:** `?source=pwa` é exatamente o `start_url` de
   [`public/app.webmanifest`](../public/app.webmanifest) (`"start_url": "/?source=pwa"`,
   `"display": "standalone"`). A sessão começou no **PWA instalado**.
3. **Estado impresso:** o `#root` do app estava **visível** e os dois templates de recibo
   estavam **escondidos**. Horário coerente (13:00 BRT = 16:00Z).

---

## 3. Como o motor atual funciona

O recibo **não** é um documento separado. Ele é um `<div>` renderizado via `createPortal`
ao lado do `#root`, dentro do mesmo documento do app:

- [`pages/PDV.tsx:1263`](../pages/PDV.tsx) → portal para `document.body` (linha 1733)
  - `#receipt-content-80mm` — classes `hidden print-only print-layout print-layout-80mm`
  - `#receipt-content-a4` — classes `hidden print-only print-layout print-layout-a4`
- [`pages/PDVHistory.tsx:2484`](../pages/PDVHistory.tsx) → mesma estrutura, código duplicado.

A revelação depende inteiramente do bloco `@media print` de
[`index.css:1150-1218`](../index.css):

```css
.print-layout                              { display: none  !important; }
body[data-print-layout] #root              { display: none  !important; }
body[data-print-layout='80mm'] .print-layout-80mm { display: block !important; }
body[data-print-layout='a4']   .print-layout-a4   { display: block !important; }
```

E o fluxo de impressão ([`pages/PDV.tsx:1099-1125`](../pages/PDV.tsx)):

```
clique "Imprimir agora"
  → clearPrintLayout()
  → applyPrintPageSize(layout)          // injeta <style media="print"> com @page
  → body.setAttribute('data-print-layout', layout)
  → closePrintFormatModal()
  → addEventListener('afterprint', clearPrintLayout, { once: true })   // ⚠️
  → setTimeout(280ms) → requestAnimationFrame → window.print()          // ⚠️
```

`clearPrintLayout()` remove o atributo **e** a tag de `@page`.

---

## 4. Causa raiz

### 4.1 Reprodução do sintoma (validada)

Rodei o bloco `@media print` real do `index.css` em Chromium headless com `emulateMedia:
'print'`, medindo a visibilidade computada de cada elemento:

| Estado do `<body>` | `#root` | recibo A4 | recibo 80mm |
|---|---|---|---|
| `data-print-layout="a4"` | oculto | **visível** | oculto |
| `data-print-layout="80mm"` | oculto | oculto | **visível** |
| **sem o atributo** | **visível** | oculto | oculto |

A terceira linha é *exatamente* o PDF que o usuário recebeu. Logo: **no instante em que o
iOS rasterizou a página, `data-print-layout` não estava no `<body>`.**

### 4.2 Por que o atributo sumiu

Dois mecanismos, ambos reais, ambos suficientes sozinhos:

**(M1) `afterprint` desfaz a preparação antes da rasterização.**
Em Safari moderno `window.print()` **não bloqueia**: retorna imediatamente e o `afterprint`
dispara logo em seguida, enquanto a folha de impressão do iOS ainda está aberta. A
rasterização (o "Quartz PDFContext" dos metadados) acontece **depois**, quando o usuário
confirma. Nesse momento `clearPrintLayout` já rodou → `#root` voltou a aparecer e o recibo
voltou a ficar `display:none`. Esse comportamento do Safari é documentado pela biblioteca
`react-to-print` ("*the `afterprint` event may fire immediately, before the print dialog is
closed, on newer versions of Safari where `window.print` does not block*").
Sinal de que a equipe já esbarrou num sintoma parente: o comentário em `index.css:1173-1175`
menciona "*drivers de impressora Wi-Fi assíncronos*".

**(M2) O caminho de impressão do iOS nunca executa o JS do app.**
No PWA instalado (`display: standalone`) a impressão via `window.print()` é notoriamente
problemática no iOS (não abre a folha / trava). O usuário então imprime pelo menu do
sistema (Compartilhar → Imprimir). Esse caminho **não passa por `handlePrintReceipt`**, o
atributo nunca é setado, e o resultado é idêntico. **Não existe nenhum listener de
`beforeprint`** no projeto para cobrir esse caminho.

Agravante do M2: o `setTimeout(280 ms)` antes de `window.print()` quebra a cadeia de
*user activation* — Safari pode simplesmente ignorar a chamada por não estar dentro do gesto
do usuário.

---

## 5. Defeitos secundários encontrados

| # | Defeito | Local | Impacto |
|---|---|---|---|
| 1 | `afterprint` limpa o layout (corrida com rasterização assíncrona) | `PDV.tsx:1106`, `PDVHistory.tsx:515` | **A falha reportada** |
| 2 | Nenhum listener de `beforeprint` | — | ⌘P / Compartilhar→Imprimir sempre imprimem lixo |
| 3 | `setTimeout` antes de `print()` quebra o gesto do usuário | `PDV.tsx:1120`, `PDVHistory.tsx:524` | print() ignorado no Safari |
| 4 | Implementação duplicada e **divergente** | `PDV.tsx` vs `PDVHistory.tsx` | Delay 280 vs 180 ms; margem A4 6mm vs 10mm; `--pdv-a4-print-scale: 0.74` só no PDV → **a mesma venda sai diferente** conforme a tela de origem |
| 5 | `@page { size: 80mm auto }` é ignorado pelo WebKit | `PDV.tsx:1093` | Recibo 80mm sai em A4 no iPhone |
| 6 | `zoom` para escalar o A4 não é propriedade padrão; fallback via `transform` | `index.css:1199-1210` | Corte/estouro de página no Firefox |
| 7 | Impressora térmica (Web Serial) só existe no PDVHistory | `PDVHistory.tsx:254` | Sem térmica logo após a venda; e Web Serial **não existe** no Safari/iOS |
| 8 | `window.print()` cru, sem preparo algum | `Warranties.tsx:1184` | Imprime o app inteiro |
| 9 | `clearPrintLayout` também cancela `pendingPrintTimeoutRef` | ambos | Um `afterprint` atrasado pode **cancelar a próxima** impressão agendada |

---

## 6. Análise: trocar o motor de impressão

O ponto estrutural: **hoje o documento impresso é o app**. Toda a corretude depende de
esconder o app e revelar um `<div>` no momento exato — algo que nenhum navegador garante,
e que o iOS comprovadamente quebra.

### Opção A — Corrigir o motor atual (`@media print` + atributo)

Reaplicar o layout em `beforeprint`; **nunca** limpar em `afterprint` (limpar por timer/
próxima interação); chamar `print()` dentro do gesto; unificar PDV/PDVHistory num hook único.

- ✅ Baixo risco, poucas linhas, resolve M1 e M2, mantém o visual atual.
- ❌ Continua dependendo de o navegador aplicar `@page`/`@media print`; 80mm continua saindo
  em A4 no iOS; segue impossível de testar de verdade (jsdom só verifica o atributo).

### Opção B — `<iframe srcdoc>` isolado + `iframe.contentWindow.print()`

Documento autocontido, sem estado global.

- ✅ Padrão da indústria em desktop; elimina toda a classe de bug.
- ❌ **Não resolve a plataforma do chamado**: no iOS Safari imprimir iframe pelo pai é uma
  limitação conhecida (imprime o documento de topo). Inútil para o caso reportado.

### Opção C — Janela dedicada (`window.open` + `print()`)

- ✅ Funciona bem em desktop.
- ❌ Bloqueio de pop-up; no PWA standalone do iOS joga o usuário para fora do app; e recai no
  mesmo `print()` problemático do iOS.

### Opção D — PDF client-side raster (`html2canvas` + `jsPDF`) — **já existe no repo**

[`utils/generateReceiptPdf.ts`](../utils/generateReceiptPdf.ts) já gera o A4 em PDF para o
envio por WhatsApp, e está coberto por teste.

- ✅ Determinístico e WYSIWYG; **zero** dependência de `@media print`, de `@page` ou do
  timing de `print()`; funciona no PWA do iOS (compartilhar → Imprimir/AirPrint); reaproveita
  pipeline já validado em produção.
- ❌ Saída **rasterizada** (JPEG): texto não selecionável, arquivo grande, IMEI pode ficar
  borrado em impressora térmica. `html2canvas` está sem manutenção (1.4.1, 2022) e não
  entende CSS moderno — o repo tem **107 usos de `color-mix()`** no `index.css`, e foi
  justamente por isso que o `RECEIPT_CAPTURE_CSS` precisou neutralizar cores no `!important`.
  Frágil a qualquer evolução do design system.

### Opção E — PDF **vetorial** gerado por código (`jsPDF`, já é dependência) — **recomendado**

Construir o recibo direto na API de texto do jsPDF, a partir de um modelo de dados único —
exatamente o que o `buildSaleReceiptBuffer` já faz para ESC/POS
([`utils/thermalPrinter.ts:106`](../utils/thermalPrinter.ts), a partir de
`ThermalReceiptData`). Um `buildSaleReceiptPdf(data, layout)` irmão, com page size `80mm ×
auto` ou A4.

- ✅ Determinístico, idêntico em todo device; texto vetorial selecionável e nítido; arquivo
  de poucos KB; **sem** `html2canvas`, sem `@media print`, sem `@page`, sem corrida de
  eventos; **testável de verdade** (asserção sobre o conteúdo do PDF, não sobre um atributo
  do `<body>`); uma fonte de dados única para térmica, PDF, WhatsApp e tela.
- ❌ Layout escrito em código, não em JSX/Tailwind — divergência inicial de visual em relação
  ao template A4 atual, e um custo real de implementação (estimo 1–2 dias para os dois
  layouts + testes).

### Opção F — Renderização no servidor (edge function → PDF)

- ✅ Controle total, independe do device.
- ❌ Precisa de renderizador PDF em Deno, latência, custo, e offline deixa de funcionar.
  Desproporcional para um cupom simples.

### Veredito

| Critério | A (patch) | B (iframe) | D (raster) | **E (PDF vetorial)** |
|---|---|---|---|---|
| Resolve o bug no iOS/PWA | parcial | ❌ | ✅ | ✅ |
| Independe de `@media print` | ❌ | ❌ | ✅ | ✅ |
| Fidelidade 80mm | ❌ | parcial | parcial | ✅ |
| Qualidade do texto | ✅ | ✅ | ❌ raster | ✅ |
| Testável em CI | ❌ | ❌ | parcial | ✅ |
| Custo | horas | horas | horas | 1–2 dias |

---

## 7. Recomendação

**Fase 1 — hotfix (hoje, baixo risco).** Extrair um hook único `useReceiptPrint` usado por
PDV e PDVHistory que: (a) registre `beforeprint` reaplicando o layout — cobrindo ⌘P e
Compartilhar→Imprimir; (b) **não** limpe em `afterprint`, e sim por timer longo/próxima
navegação; (c) chame `window.print()` dentro do gesto do usuário; (d) unifique as constantes
divergentes do defeito nº 4. Isso já elimina a folha em branco reportada.

**Fase 2 — troca do motor (Opção E).** `buildSaleReceiptPdf(data, layout)` em jsPDF,
alimentado pelo mesmo `ThermalReceiptData` do ESC/POS. "Imprimir" passa a gerar o PDF e
entregá-lo: em desktop, `print()` sobre o blob; em iOS/PWA, abrir/compartilhar o PDF (o
usuário imprime pelo AirPrint). O `@media print` do app e o `html2canvas` do envio por
WhatsApp podem então ser aposentados.

**Manter:** o caminho ESC/POS via Web Serial para térmica em desktop — é o único que produz
qualidade nativa de cupom — e passar a oferecê-lo também no PDV, não só no histórico.

---

## 8. O que foi implementado

Ambas as fases foram aplicadas.

**Fase 1 — motor DOM corrigido** ([`utils/domReceiptPrint.ts`](../utils/domReceiptPrint.ts) +
[`hooks/useReceiptPrint.ts`](../hooks/useReceiptPrint.ts)), agora rede de segurança:

- `beforeprint` prepara o comprovante — cobre ⌘P e Compartilhar → Imprimir, que nunca
  executam o handler do botão (defeito nº 2).
- **A preparação não é mais desfeita em `afterprint`** (defeito nº 1, a causa raiz). A
  limpeza acontece ao sair da tela.
- `window.print()` é chamado de forma síncrona, dentro do gesto (defeito nº 3).
- Um módulo só para PDV e PDVHistory, com constantes únicas (defeito nº 4).

**Fase 2 — motor de PDF vetorial**, agora o caminho principal:

- [`utils/receiptPdf.ts`](../utils/receiptPdf.ts) — `composeSaleReceipt` (puro, sem jsPDF)
  monta o comprovante como blocos; `buildSaleReceiptPdf` desenha em 80mm (altura sob medida,
  passe de medição + página exata) ou A4 (com paginação).
- [`utils/deliverReceiptPdf.ts`](../utils/deliverReceiptPdf.ts) — entrega por plataforma:
  Web Share com arquivo no iOS/Android (folha nativa dentro do PWA, com AirPrint), iframe
  próprio com o blob no desktop, download como último recurso.
- [`utils/receiptData.ts`](../utils/receiptData.ts) — modelo de dados único (`ThermalReceiptData`)
  para ESC/POS, PDF e tela, extraído do PDVHistory. É o que garante que a mesma venda não
  saia mais diferente conforme a tela de origem.

O ESC/POS via Web Serial continua sendo o caminho preferencial quando há térmica conectada.

**Fora do escopo desta entrega:** oferecer a impressora térmica também no PDV (hoje só no
histórico — defeito nº 7) e o `window.print()` cru em `Warranties.tsx` (defeito nº 8). Ambos
são telas/fluxos distintos do comprovante de venda e ficam para uma próxima passada.

## 9. Design do comprovante (auditoria + evolução)

Com o motor novo em produção, o comprovante gerado (venda #333) foi auditado
pelas 3 lentes de `refatorar-ui`.

**NOTA ANTERIOR: 4/10** — funcionava, mas fazia pensar.

- **Lente 1 (Cognição)** ❌ `TOTAL PAGO` igual ao `Total da venda` enquanto havia
  `Devedor R$ 1.950,00` na lista: o rótulo afirmava um pagamento que não
  aconteceu, e o saldo em aberto — a informação que o cliente mais precisa —
  ficava sem nenhum destaque.
- **Lente 2 (Clareza)** ❌ Tudo em 10pt preto; títulos de seção do mesmo tamanho
  do corpo; 11 réguas horizontais competindo entre si; `Acréscimo cartão
  R$ 0,00` ocupando linha sem informar nada.
- **Lente 3 (Execução)** ❌ Sem logo, sem cor, cabeçalho inteiro centralizado
  (sem ponto de entrada para a leitura), total sem destaque tipográfico.

**Correções aplicadas**

| # | Lente | Problema | Correção |
|---|-------|----------|----------|
| 1 | L1 | `TOTAL PAGO` mentia com saldo em aberto | rótulo vira `Total da compra` quando há pendência |
| 2 | L1 | Saldo devedor invisível | painel âmbar (`#fffbeb` + faixa `#b45309`) com o valor em destaque |
| 3 | L1 | "dívida ativa" é jargão do ERP | "Pagamento pendente registrado na loja" |
| 4 | L2 | Sem hierarquia | 3 eixos: peso, tamanho e cor — total em 16,6pt bold, seções em versalete 7,2pt `muted`, detalhes de item em 8pt `#64748b` |
| 5 | L2 | 11 réguas | um fio `#e2e8f0` por seção; agrupamento por proximidade |
| 6 | L2 | `R$ 0,00` como ruído | desconto e acréscimo só aparecem quando > 0 |
| 7 | L2 | Folha 2+ sem contexto (*trunk test*) | cabeçalho de continuação + `Página X de Y` |
| 8 | L3 | Sem logo | `businessProfile.logoUrl` no cabeçalho, proporção preservada; monograma da loja como estado vazio |
| 9 | L3 | Sem identidade | faixa `brand-500` (`#2563eb`) sangrando no topo |
| 10 | L3 | Tudo centralizado | A4 em duas colunas — marca à esquerda, nº do documento à direita |
| 11 | L3 | Identificação empilhada | painel `#f8fafc` em 3 colunas, altura adaptativa ao nome |
| 12 | L3 | Documento terminava no ar | rodapé com negócio/CNPJ e nota de emissão eletrônica |

**Cor com parcimônia (teste do cinza):** o azul aparece só em três lugares —
faixa da marca, rótulo do documento e o total. As seções ficaram em `muted`
justamente para não competir com o número que precisa saltar. A hierarquia se
sustenta em escala de cinza.

**A bobina de 80mm não herda nada disso.** A térmica imprime em 1 bit: fundo
colorido vira mancha chapada e engole o texto. O layout tem paleta monocromática
própria (`MONO_PALETTE`), sem painéis preenchidos, com hierarquia só por peso e
tamanho — mesmo conteúdo, forma diferente.

## 10. Validação sugerida

Cobertura automatizada adicionada (28 testes):

- [`utils/receiptPdf.test.ts`](../utils/receiptPdf.test.ts) — conteúdo do comprovante
  (itens, trade-in, desconto, acréscimo de cartão, garantia por condição), tamanho de página
  80mm/A4, crescimento da bobina e paginação do A4.
- [`utils/deliverReceiptPdf.test.ts`](../utils/deliverReceiptPdf.test.ts) — roteamento por
  plataforma: compartilhar, cancelamento tratado como decisão do usuário, queda para
  impressão, queda para download e o limite de tempo do iframe.
- [`hooks/useReceiptPrint.test.tsx`](../hooks/useReceiptPrint.test.tsx) — trava o contrato de
  eventos: `beforeprint` prepara, **`afterprint` não limpa** (a regressão de origem),
  desmontagem limpa.

**Verificação manual ainda obrigatória, no iPhone com o PWA instalado.** É a única
plataforma onde o bug se manifestou e nenhum teste deste repo a reproduz: jsdom não imprime
e o Chromium headless não tem a rasterização assíncrona do WebKit. O que se espera ver: o
botão "Imprimir agora" abre a folha de compartilhamento do iOS com um PDF de nome
`comprovante-<nº>.pdf`, e o AirPrint sai com o comprovante — não com o menu do app.
