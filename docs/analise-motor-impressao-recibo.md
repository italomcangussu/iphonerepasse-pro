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

## 8. Validação sugerida

- Teste de unidade sobre `buildSaleReceiptPdf` (conteúdo textual e número de páginas),
  espelhando o que já existe em `utils/thermalPrinter.test.ts`.
- Smoke Playwright: `page.emulateMedia({ media: 'print' })` + matriz de visibilidade da
  seção 4.1, para travar a regressão enquanto a Fase 1 estiver em produção.
- Verificação manual obrigatória **no iPhone, com o PWA instalado** — é a única plataforma
  onde o bug se manifesta e nenhum teste automatizado deste repo a cobre.
