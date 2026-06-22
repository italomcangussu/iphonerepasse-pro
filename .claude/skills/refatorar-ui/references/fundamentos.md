# Fundamentos — Lente 1 (Cognição/Norman) + Lente 2 (Clareza/Krug)

As duas lentes que vêm **antes** do visual. São checks binários: marque ✅/❌ e,
para cada ❌, escreva a correção concreta.

---

## LENTE 1 — COGNIÇÃO (Donald Norman)

Objetivo: fechar os **dois golfos**.
- **Golfo de Execução** — "consigo fazer o que quero aqui?" (descobrir a ação e como executá-la).
- **Golfo de Avaliação** — "o que aconteceu depois que agi?" (perceber e interpretar o resultado).

Toda interação percorre 7 estágios: meta → intenção → especificar ação →
executar → perceber estado → interpretar → avaliar. UI ruim trava em algum
estágio. Os checks abaixo cobrem todos.

### 1.1 Affordance & Signifier — "parece o que faz?"
- [ ] O que é **clicável parece clicável** (e o que não é, não parece).
- [ ] O que é **arrastável** sugere arraste (handle, sombra ao pegar — ver toast swipe).
- [ ] Campo editável **parece** editável (borda/fundo/cursor), não um texto estático.
- [ ] Affordance percebida = real. Nada que **pareça** botão e não seja.
> Norman: "Quando um objeto simples precisa de instruções, o design falhou."
> Se você precisa de um tooltip para explicar o óbvio, **redesenhe o signifier**.

### 1.2 Modelo conceitual — "bate com o modelo mental?"
- [ ] O comportamento corresponde ao que o usuário **já espera** daquele tipo de objeto.
- [ ] Toggle/switch = liga/desliga com **efeito imediato**. Checkbox = seleção que só vale ao **salvar o formulário**. Não troque um pelo outro.
- [ ] Botão = ação pontual. Link = navegação. Não estilize link como botão primário sem motivo.
- [ ] A "imagem do sistema" (o que está na tela) comunica o modelo certo — sem isso o usuário inventa um modelo errado.

### 1.3 Mapeamento natural — "controle e efeito estão ligados?"
- [ ] O controle fica **perto/alinhado** com aquilo que ele afeta (toggle à direita do seu label; ação de um card dentro do card).
- [ ] Disposição espacial espelha a relação (ordem dos campos = ordem mental da tarefa).
- [ ] Ação **primária** e ação **destrutiva** ficam **distantes** e visualmente distintas (evita slip de "description error").

### 1.4 Feedback — "toda ação tem resposta visível e imediata?"
- [ ] **Toda** ação responde **na hora**: estado `:active`/pressed, spinner, toast, update otimista.
- [ ] Operação > ~400ms mostra progresso (skeleton/spinner), não tela congelada.
- [ ] Resultado de sucesso é **visível** (toast, mudança de estado), não silencioso.
- [ ] Som/feedback tátil só reforça; nunca é o único canal.
> Sem feedback o usuário repete a ação (clica 2×, envia 2×) → erros.

### 1.5 Restrições (constraints) — "o design impede o erro antes de acontecer?"
Prevenir > corrigir. Quatro tipos:
- **Física/forçada**: o inválido é **impossível** (máscara que só aceita dígitos; `<input type>` correto; botão desabilitado).
- **Semântica/Cultural**: usa significado conhecido (vermelho+ícone = perigo; ✓ = ok).
- **Lógica**: só uma combinação faz sentido e ela fica óbvia.
- [ ] O caminho errado é **bloqueado** ou claramente sinalizado, não apenas "permitido e depois punido".

### 1.6 Design para o erro — "erra fácil, recupera fácil, sem culpa?"
Pessoas **vão** errar. Projete para isso (Cap. 5 de Norman):
- [ ] **Reversível > confirmação.** Prefira ação + **undo** (toast "Excluído. Desfazer") a um diálogo "tem certeza?". O diálogo de confirmação **não pega o lapso** (o usuário confirma a ação errada no automático).
- [ ] **Forcing function** só onde o custo é alto/irreversível (`ConfirmDialog`, dupla confirmação). Não em tudo — alarme que toca sempre é ignorado/desligado.
- [ ] Mensagem de erro = **o que houve + como corrigir**, em linguagem humana. **Nunca culpa o usuário.** (modelo: `utils/authErrors.ts` → "Falha de conexão (host). Verifique DNS/internet e tente novamente.")
- [ ] Erro **detectável** (visível, perto da causa) e com efeito **mínimo**.
- [ ] Distinga **slip** (ação certa, execução errada → previna com constraints/feedback) de **mistake** (objetivo errado → previna com modelo conceitual claro).

### 1.7 Visibilidade de estado — "dá pra saber onde estou e o que está ativo?"
- [ ] Item ativo/selecionado/atual é **visível** (aba ativa, "você está aqui").
- [ ] O que mudou fica evidente (diff, destaque temporário).
- [ ] Conhecimento **no mundo > na cabeça**: não exija que o usuário memorize; mostre na tela (labels, valores atuais, dicas no contexto).

---

## LENTE 2 — CLAREZA (Steve Krug)

Primeira lei: **"Não me faça pensar."** Cada tela/elemento deve ser
**auto-evidente** — entendido num relance, sem esforço consciente.

### Como as pessoas realmente usam (aceite isto)
- **Não leem, escaneiam** — varrem procurando palavras/âncoras.
- **Satisficem** — pegam a **primeira opção razoável**, não a ótima.
- **Não descobrem como funciona** — "se vira" e segue usando do mesmo jeito.
> Projete para o escaneio e para o "se virar", não para o leitor atento ideal.

### Checks
- [ ] **Auto-evidência**: entende-se sem instrução. (Se não, é "auto-explicável" no máximo — pior. Mire em auto-evidente.)
- [ ] **Escaneável**: hierarquia deixa varrer e achar sem ler tudo (rótulo/valor, agrupamento, peso, âncoras).
- [ ] **Sem pontos de interrogação**: nada ambíguo. "Isso é clicável?", "esse ícone faz o quê?", "esse campo é obrigatório?", "onde clico?" → cada dúvida é um defeito.
- [ ] **Convenção > invenção**: usa o padrão que o usuário já conhece (X fecha, lupa = busca, toggle iOS, vermelho+ícone = erro). Inovar **só** se for clara e comprovadamente melhor.
- [ ] **Corte de palavras**: "remova metade das palavras, depois remova metade de novo". Rótulos curtos, microcopy direto, zero texto de boas-vindas inútil.
- [ ] **Caminho feliz óbvio**: a ação que 90% querem é a mais visível e a primeira razoável; não obrigue a comparar tudo.
- [ ] **Hierarquia visual reflete relação** (Krug): mais importante = mais destaque; itens semelhantes parecem semelhantes; o que é parte de algo está visualmente **aninhado** dentro.

### Reservatório de boa-vontade — não esvazie
Cada atrito gasta a paciência do usuário. **Esvazia o reservatório:**
- esconder informação que ele quer (preço, prazo, como cancelar);
- punir por não fazer "do seu jeito" (formato rígido sem máscara/ajuda);
- pedir dados desnecessários;
- aparência amadora / quebrada;
- jargão interno.
**Reabastece:** atalhos, defaults sensatos, erros que perdoam (undo), economia de cliques, dizer a verdade sobre custo/tempo.

### Teste rápido (faça mentalmente em toda tela)
- **Squint test**: aperte os olhos / desfoque — o que salta é o que importa? A ação primária ainda domina?
- **Trunk test** (Krug): "jogado" nessa tela sem contexto, dá pra responder: *Que tela é esta? Onde estou no fluxo? Quais as opções principais? Como volto?*

---

## Como reportar (saída desta lente)
Para cada check ❌:
```
[Lente.N] <princípio> → <o problema concreto> → <correção mensurável + token/primitivo>
```
Ex.: `[1.4 Feedback] Botão "Salvar" não mostra estado de envio → adicione spinner + disabled durante o submit (estado loading do recipe "campo/botão" em componentes.md).`
