# Receitas de Componentes

Cada receita: **quando usar / quando NÃO** · **anatomia** · **as 3 lentes
aplicadas** · **estados obrigatórios** · **specs no vocabulário do repo** ·
**anti-padrões + a11y**. Reúse os primitivos existentes antes de criar.

Estados que **todo** componente interativo precisa ter (cheque sempre):
`default · hover · focus-visible · active/pressed · disabled (com motivo) ·
loading · empty · error · success` × **dark mode** × **reduced-motion**.

---

## 0. Matriz de decisão: qual canal de feedback? (resolve a confusão mais comum)

Escolha pelo cruzamento **severidade × persistência × precisa de ação**:

| Canal | Quando | Persistência | Bloqueia? | Primitivo |
|------|--------|--------------|-----------|-----------|
| **Toast** | confirmação efêmera de algo que **já aconteceu** (salvo, enviado, copiado); undo | auto-some (3–6s) | não | `ToastProvider` (`useToast`) |
| **Banner** | condição **persistente** do contexto (offline, plano expirado, modo sandbox); aviso que deve ficar até resolver | fica até resolver/dispensar | não | `components/ui/Banner` |
| **Inline (campo)** | erro/dica **de um campo específico**, perto da causa | enquanto inválido | não | ver §5 e §7 |
| **Modal/Dialog** | decisão **necessária agora** ou tarefa focada; **interrompe** de propósito | até decidir | **sim** | `Modal` / `ConfirmDialog` |
| **Inline (página)** | estado da tela toda: vazio, carregando, erro de carregamento | até mudar | parcial | empty/skeleton/error state |

Regras (Norman/Krug):
- **Sucesso silencioso é proibido** → no mínimo um toast.
- **Erro de validação NÃO é toast** → é **inline** no campo (perto da causa, persistente). Toast some antes do usuário ler e corrigir.
- **Não use modal** para o que um toast/banner resolve. Modal interrompe — reserve para decisão necessária ou irreversível.
- **Confirmação destrutiva**: prefira **ação + undo via toast**; só use `ConfirmDialog` se irreversível/caro (§3).

---

## 1. Toast (`components/ui/ToastProvider` + `ToastViewport`)

**Usar:** feedback breve do que já ocorreu; oferecer **undo**. **Não usar:**
erro de campo (→inline), info persistente (→banner), decisão (→modal).

**Anatomia:** ícone(kind) · [título] · mensagem · [ação] · fechar(44px).

**3 lentes:**
- **Cognição:** é o **feedback** do 1.4. Ação de undo materializa "erro reversível" (1.6) — toast de exclusão **sempre** com `action: { label:'Desfazer' }`. Swipe-to-dismiss = affordance física (drag x, solta >80px). `role="status"` (leitor de tela anuncia).
- **Clareza:** 1 linha, sem título quando a mensagem basta; verbo no passado ("Venda salva"). Corte palavras. Convenção: canto superior-direito (desktop) / inferior (mobile) — já implementado.
- **Execução:** `liquid-glass` + `shadow-ios26-lg` (flutuante = elevação alta) + `rounded-ios-2xl`. Cor **só na borda + ícone** (`chromeFor`/`iconFor`), texto cinza neutro — evita "lavado". `iosSnappySpring`. Empilha com `gap-3`.

**Estados/specs:** kinds `success|error|info|warning` (`toastTypes.ts`); `durationMs` maior em `error`/com ação; alvo de fechar `w-11 h-11`; `useReducedMotion` desliga drag. **a11y:** `role="status"`, `aria-label="Fechar"`, foco não roubado.

**Anti-padrões:** toast para erro de formulário; toast sem undo em ação destrutiva; > 1 linha de texto; cor de fundo saturada com texto cinza; duração curta demais em mensagem com ação (usuário não alcança o botão).

---

## 2. Banner (`components/ui/Banner`)

**Usar:** condição **persistente** do contexto (offline `OfflineBanner`, update disponível `UpdateBanner`, consentimento `PrivacyConsentBanner`, modo restrito). **Não usar:** confirmação efêmera (→toast).

**Anatomia:** ícone(kind) · título · mensagem(rica) · [ação] · [fechar].

**3 lentes:**
- **Cognição:** comunica **estado do sistema** (1.7) que persiste; a ação resolve a causa ("Atualizar", "Reconectar"). Feedback contínuo, não pontual.
- **Clareza:** diz **o que está acontecendo + o que fazer**. Dispensável só se não for crítico (offline crítico **não** tem X).
- **Execução:** `ios-card` + `chrome` por kind (fundo `*-50` claro + borda `*-200`) — aqui fundo colorido **suave** é ok porque o texto é escuro (`text-gray-700/900`), não cinza sobre cor saturada. `iosFastEase`. Largura total do container; respiro `p-4 gap-4`.

**Estados/specs:** `kind` define ícone+chrome (mapa `KINDS`); `action` vira link `text-brand-600`; fechar `rounded-full w-8 h-8` (banner não-crítico). **a11y:** título em `<h4>`; `aria-label="Dispensar alerta"`.

**Anti-padrões:** banner para algo efêmero (poluição permanente); banner crítico com botão de fechar fácil; empilhar 3 banners (priorize 1, vire lista/contagem).

---

## 3. Modal / Dialog (`components/ui/Modal`, `ConfirmDialog`)

**Usar:** tarefa focada (formulário de criar/editar) ou decisão **necessária agora**. **Não usar:** o que toast/banner/inline resolve.

**Anatomia:** backdrop · sheet/painel · [título] · corpo (rolável) · footer(ações).

**3 lentes:**
- **Cognição:** interrupção **deliberada** = forcing function. Backdrop + foco preso (focus trap) impedem agir "por baixo". Mobile: drag-to-dismiss (bottom-sheet) = affordance física. `ConfirmDialog` é forcing function p/ irreversível — **mas** prefira undo (1.6) quando der. Esc fecha; foco inicial no 1º campo (`initialFocusSelector`).
- **Clareza:** título responde "que decisão é esta?"; **botão diz o verbo**, não "OK"/"Sim" ("Excluir venda", "Salvar alterações"). Ação primária à direita, destrutiva separada. Corte campos: peça só o necessário (reservatório de boa-vontade).
- **Execução:** desktop `centered` `md:max-w-*` por `size`; mobile **bottom-sheet** com `iosSheetSpring`; backdrop escurecido; painel `ios-card`/`liquid-glass` + `shadow-ios26-lg`/maior. Footer fixo, ações com hierarquia (primária sólida `bg-brand-600`, secundária outline).

**Estados/specs:** `open` controlado; `closeOnBackdrop` (false em formulário com dados); `asForm` → Enter confirma; `zIndexClass`. **a11y:** `role="dialog" aria-modal`, focus trap, retorno de foco ao gatilho, Esc.

**Anti-padrões:** modal sobre modal; modal para mera notificação; "Tem certeza? [Sim][Não]" sem dizer o que será feito (Norman: confirmação que não pega o slip); fechar acidental perdendo formulário preenchido; backdrop sem escurecer (sem separação de camada).

---

## 4. Card

**Usar:** agrupar info+ações de **uma entidade** (item de estoque, venda, lead). **Não usar:** como botão gigante sem affordance; para texto corrido longo.

**Anatomia:** [mídia] · cabeçalho(título+meta) · corpo · [rodapé/ações].

**3 lentes:**
- **Cognição:** se o card todo é clicável, ele **parece** clicável (hover eleva, cursor) e a ação primária é óbvia. Ações do card vivem **dentro** dele (mapeamento). Não esconda a ação principal atrás de menu se ela é frequente.
- **Clareza:** padrão **rótulo/valor** — des-enfatize rótulos, destaque valores. Escaneável: o que importa primeiro. Aninhe visualmente o que é sub-info.
- **Execução:** `ios-card` + `shadow-ios26-md`; **bordas viram sombra/2 tons**; `p-4`/`p-6`; raio `rounded-ios-xl`. Hover: subir 1 nível de sombra (`md`→`lg`) com `iosFastEase`. **Accent border** (faixa `accent`/`brand` no topo) p/ destacar tipo/estado. Imagem com `object-cover` + raio consistente.

**Estados/specs:** hover/press (eleva/afunda); selecionado (`shadow-ios26-glow` ou ring `brand`); loading (skeleton `animate-shimmer`); vazio (placeholder com ícone). Em lista, anime entrada com `iosStagger`.

**Anti-padrões:** card "caixa com borda" sem hierarquia interna; toda coluna/campo com mesmo peso; sombra cinza; ação primária escondida; cards de alturas desalinhadas numa grade (use grid + `items-stretch`).

---

## 5. Erro (inline de campo · estado de página · global)

Mensagem de erro é **design de recuperação** (Norman 1.6), não decoração.

**Regra de canal:** erro de **campo** → inline abaixo do campo. Erro ao **carregar a tela** → estado de erro na página (ícone+texto+"Tentar de novo"). Erro de **operação** (rede, auth) → toast/banner com retry, mensagem humana via `normalizeAuthError` (`utils/authErrors.ts`).

**3 lentes:**
- **Cognição:** diz **causa + correção**, perto da causa, **sem culpar** ("CPF inválido — use 11 dígitos", não "Erro 422"). Reversível/retry quando possível. Previna com constraints (§6 máscara) — o melhor erro é o que não acontece.
- **Clareza:** linguagem humana, curta, específica. Nada de "Erro inesperado" sozinho. Convenção: vermelho **+ ícone** `AlertCircle`.
- **Execução:** inline `text-ios-footnote text-error` (dark `text-dark-error`) + ícone `w-4 h-4`, `mt-1`. Campo errado ganha `border-error`/`ring-error`. Estado de página: ícone grande, `text-ios-title-3`, parágrafo `text-text-muted`, botão primário "Tentar de novo".

**Estados/specs:** validação on-blur/on-submit (não a cada tecla — Krug: não puna enquanto digita); foco vai para o 1º campo inválido; `aria-invalid` + `aria-describedby` ligando campo↔mensagem; mensagem com `role="alert"` quando aparece.

**Anti-padrões:** erro de validação em toast (some antes de corrigir); "campo inválido" genérico (qual? por quê?); só borda vermelha sem texto (cor como único sinal); culpar o usuário; despejar stack/código de status cru; alerta global pra erro de 1 campo.

---

## 6. Máscara de input (`utils/inputMasks.ts` — reúse, não reimplemente)

Máscara = **constraint física** (Norman 1.5): impede o formato inválido em vez de reclamar depois.

**Disponíveis:** `formatCpf · formatCnpj · formatPhone · maskCurrencyInput`/`parseCurrencyBRL`/`formatCurrencyBRL` · `formatDateBRL`/`formatDateTimeBRL` (TZ Fortaleza). **Use estes**; só crie nova se o formato não existe.

**3 lentes:**
- **Cognição:** o usuário **não consegue** digitar errado (só dígitos passam; pontuação entra sozinha). Reduz erro na origem.
- **Clareza:** formato visível **enquanto digita** (`(85) 99999-9999`), não exigido na cabeça. Placeholder mostra o formato esperado. `inputMode`/`type` certo abre o teclado numérico no mobile.
- **Execução:** dígito → `maskX(value)` no `onChange`; guarde o **valor cru** (dígitos/centavos) no estado e exiba o formatado; `formatCurrencyBRL` para leitura. Alinhe números à direita / `font-mono` em tabelas.

**Padrão:**
```tsx
import { formatCpf } from '@/utils/inputMasks';
<input inputMode="numeric" placeholder="000.000.000-00"
  value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} />
```
**Anti-padrões:** validar só no submit o que a máscara já garantiria; aceitar texto livre e brigar depois; reimplementar máscara que já existe em `inputMasks.ts`; perder o cursor/posição ao mascarar moeda (use `maskCurrencyInput(value, previous)`).

---

## 7. Campo / Input (label · campo · ajuda · erro)

**Anatomia (ordem fixa):** `label` → `input/control` → `texto de ajuda` → `erro`.

**3 lentes:**
- **Cognição:** label **persistente** (não placeholder-as-label — some ao digitar e vira memória na cabeça). `<label htmlFor>` liga rótulo↔campo (clicar no label foca). Estado válido/ inválido/ desabilitado **visível**; disabled mostra **por quê** (ajuda ou tooltip). Affordance: campo parece editável (borda + fundo `surface`).
- **Clareza:** label curto; ajuda explica formato/regra **antes** do erro; obrigatório sinalizado de forma consistente (`*` ou "(opcional)" nos demais — escolha 1 padrão). Agrupe campos relacionados; ordem = ordem mental da tarefa.
- **Execução:** label `text-ios-subhead font-medium text-text-secondary`; input `rounded-ios border` `min-h-[44px]` `px-3` `text-ios-body`; **focus**: `focus-visible:ring-2 ring-brand-500` + `shadow-ios26-glow` (sinal claro de foco). Ajuda `text-ios-footnote text-text-muted`. Erro: §5. Dark via `dark:` + `surface-dark-*`.

**Estados/specs:** default/focus/filled/disabled/error/success; loading (async validate → spinner no canto); `autoComplete`, `inputMode`, `type` corretos. Toque ≥ 44px. **a11y:** `id`/`htmlFor`, `aria-describedby` (ajuda+erro), `aria-invalid`, `aria-required`.

**Anti-padrões:** placeholder no lugar do label; foco sem indicação visível (acessibilidade); validar a cada tecla; campo < 44px no mobile; pedir dado que você não precisa (reservatório); largura de campo não condizente com o conteúdo (CEP curto, e-mail longo) — dá pista do tamanho esperado (constraint/mapping).

---

## 8. Toggle / Switch

**Usar:** ligar/desligar **com efeito imediato** (preferência, modo). **Não usar:** seleção que só vale ao salvar (→ checkbox); escolha entre 2+ opções (→ segmented/radio); ação (→ botão).

**3 lentes:**
- **Cognição:** modelo conceitual = interruptor físico → **muda na hora** (com feedback). Mapeamento: toggle **à direita** do label que ele controla. Se a mudança é assíncrona e pode falhar, mostre estado de transição e reverta com toast em erro (feedback + reversível).
- **Clareza:** o label diz o **estado/efeito**, não "toggle". Estado on/off **inequívoco** — não dependa só da cor (HIG): posição do thumb + (opcional) ícone/texto. Convenção iOS: trilho preenchido = on.
- **Execução:** on `bg-brand-500`/`bg-ios-green`, off `bg-surface-300`/`bg-surface-dark-200`; thumb branco com `shadow-ios26-sm`; transição `iosFastEase` (translate-x); trilho `rounded-full` `min-w-[44px]` e alvo total ≥ 44×44. `useReducedMotion` → sem slide, troca direta.

**Estados/specs:** on/off/disabled/loading(pending async)/focus-visible(`ring-brand-500`). **a11y:** `role="switch"` + `aria-checked`; acionável por teclado (Space/Enter); label associado.

**Anti-padrões:** toggle que **não** aplica na hora (devia ser checkbox+Salvar); estado só por cor (daltonismo); área de toque < 44px; toggle para ação destrutiva (use botão); ambiguidade "ligado é qual lado?" — reforce com posição + ícone.

---

## Saída por componente (modelo)
```
COMPONENTE: <nome>  ·  Nota: X/10
✅ acertos:  <o que já segue as 3 lentes>
❌ correções:
  [Lente.N] <problema> → <correção + token/classe/primitivo>
  ...
Reúso: <primitivo existente a usar em vez de criar>
Próximo passo p/ 10: <lista priorizada>
```
