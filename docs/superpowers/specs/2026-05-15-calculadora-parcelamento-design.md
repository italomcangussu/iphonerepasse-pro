# Calculadora de Parcelamento - Design

## Contexto

O app `iphonerepasse-pro` precisa ganhar um novo menu `Calculadora` para simular parcelamentos para clientes. A base funcional virá da calculadora existente em `/Volumes/DEV/projetos/warrantyguard-hdi`, especificamente de `src/pages/admin/Calculator.tsx`.

No app atual, a navegação autenticada passa por:

- `App.tsx`, onde rotas protegidas são registradas.
- `components/Layout.tsx`, onde sidebar desktop, menu mobile e bottom navigation são montados.
- `lib/permissions.ts`, onde permissões e defaults por papel são definidos.
- `tests/smoke/smokeInventory.ts`, onde as rotas e chaves do menu são cobertas por smoke tests.

## Objetivo

Adicionar uma página autenticada `Calculadora` em `/#/calculator`, visível para todos os usuários atuais (`admin`, `manager` e `seller`), com o mesmo comportamento principal da calculadora do `warrantyguard-hdi`.

A ferramenta deve permitir que o operador informe o valor líquido desejado, escolha a bandeira do cartão, veja as opções de 1x a 18x, selecione parcelas específicas e envie ou copie a simulação para atendimento ao cliente.

## Escopo

Incluído:

- Novo menu `Calculadora`.
- Nova rota protegida `/calculator`.
- Nova permissão `calculator`, visível por padrão para todos os papéis.
- Página `pages/Calculator.tsx` baseada na implementação do `warrantyguard-hdi`.
- Adaptação do toast para `components/ui/ToastProvider`.
- Persistência local das taxas com as chaves existentes `calc_rates_std` e `calc_rates_prem`.
- Compartilhamento por WhatsApp, cópia de texto completo e cópia em formato resumido para Instagram.
- Configuração local das taxas por bandeira e parcela.
- Testes focados de rota/menu e cálculo básico.

Fora de escopo:

- Salvar taxas no Supabase.
- Criar migrations.
- Integrar a calculadora diretamente ao PDV.
- Criar experiência standalone/PWA separada para a calculadora.
- Alterar regras financeiras já usadas por PDV, Financeiro ou Devedores.

## Arquitetura

### Página

Criar `pages/Calculator.tsx` como página autenticada comum do app. A página será portada da origem e ajustada para:

- usar `useToast()` do `ToastProvider` atual (`success`, `info`, `error`);
- evitar dependências específicas do projeto antigo;
- manter layout responsivo dentro do shell atual;
- respeitar tema claro/escuro onde o app já usa classes `dark:`;
- exportar apenas o componente da página.

O cálculo permanece local ao componente nesta primeira versão, porque é uma ferramenta isolada e não compartilha dados com outras telas.

### Rota

Adicionar lazy import em `App.tsx`:

- `const Calculator = lazy(() => import('./pages/Calculator'));`

Registrar rota protegida:

- caminho: `/calculator`
- permissão: `calculator`
- elemento: `<Calculator />`

### Menu

Adicionar item em `components/Layout.tsx`:

- label: `Calculadora`
- icon: `Calculator` de `lucide-react`
- path: `/calculator`
- group: `operation`
- permissionKey: `calculator`

A escolha do grupo `operation` reflete o uso em atendimento/venda, não uma configuração administrativa. No mobile, ela seguirá o comportamento existente dos itens de operação e poderá aparecer na bottom navigation conforme a ordem dos itens.

### Permissões

Adicionar `calculator` em `lib/permissions.ts`:

- incluir no union `PermissionKey`;
- incluir em `PERMISSION_DEFINITIONS` com label `Calculadora` e `routePrefixes: ['/calculator']`;
- incluir em `commonVisible`, tornando visível e editável para `manager` e `seller`;
- admins continuam recebendo todos os módulos por padrão.

Se houver dados persistidos de permissões no Supabase sem a nova chave, a lógica atual deve continuar tratando a permissão nova por defaults quando aplicável. Se os testes ou o código indicarem que permissões persistidas bloqueiam novas chaves, a implementação deve incluir o ajuste mínimo necessário no carregamento/merge de permissões, sem criar migration.

## Comportamento Da Calculadora

### Entrada

O usuário informa o valor da venda no modo "Quero Receber". Esse valor representa o líquido desejado depois da taxa da maquininha.

### Bandeira

Duas tabelas de taxa permanecem:

- `Visa / Master`, usando `calc_rates_std`;
- `Elo / Hiper`, usando `calc_rates_prem`.

### Cálculo

Para cada parcela:

1. Ler a taxa percentual configurada para a parcela.
2. Calcular `receiveFactor = 1 - taxa / 100`.
3. Calcular `total = valorLiquido / receiveFactor`.
4. Calcular `installmentValue = total / numeroDeParcelas`.

Taxas negativas devem ser tratadas como `0`. Se o fator de recebimento for inválido ou menor/igual a zero, o resultado exibido deve ser `0`.

### Compartilhamento

A página deve preservar:

- botão para abrir WhatsApp com texto formatado e copiar a simulação;
- botão para copiar texto completo;
- botão para copiar texto de Instagram, truncando quando ultrapassar o limite usado na origem;
- modo `Todas as parcelas`;
- modo `Parcelas selecionadas`, com seleção individual e "Selecionar todas".

Quando o valor informado for inválido ou nenhuma parcela estiver selecionada no modo selecionado, a página deve mostrar toast informativo.

### Configuração De Taxas

O modal de configuração permite editar taxas de 1x a 18x para cada bandeira. Ao salvar, grava em `localStorage`:

- `calc_rates_std`
- `calc_rates_prem`

Erros de JSON no carregamento devem ser tratados defensivamente durante a implementação para evitar quebra da página caso o `localStorage` tenha dados corrompidos.

## UI E Responsividade

A UI deve ser funcional e consistente com o app atual:

- conteúdo centralizado com largura máxima semelhante à origem;
- botões com área mínima confortável para mobile;
- grid de parcelas sem scroll horizontal;
- modal com altura máxima e scroll interno;
- sem cards aninhados além da estrutura necessária da ferramenta;
- sem landing page ou texto promocional.

O visual portado pode manter a hierarquia original, mas deve receber ajustes mínimos para dark mode e para evitar conflitos com o shell atual.

## Testes E Verificação

Testes esperados:

- `pages/Calculator.test.tsx`: renderiza título/campo de valor, calcula uma parcela conhecida, troca bandeira, valida toast quando tenta compartilhar sem valor.
- `components/Layout.permissions.test.tsx`: menu `nav-link-calculator` aparece para papéis com permissão e some quando a permissão é negada.
- `tests/smoke/smokeInventory.ts`: incluir `calculator` em `menuPathByKey`, `roleMenuKeys` e `smokeRoutes` com anchor da página.

Verificação manual/local:

- `npm run typecheck`
- teste unitário relevante da calculadora e navegação
- se o tempo permitir, build ou smoke de navegação

## Riscos

- A página de origem usa toast com assinatura diferente; a adaptação deve mapear chamadas explicitamente.
- A adição de um quinto item em `operation` pode deixar a bottom navigation mobile mais densa. Se ficar ruim visualmente, a implementação deve mover `Calculadora` para o grupo `management` ou ajustar a ordem para mantê-la no menu `Mais`.
- Permissões persistidas podem não incluir a nova chave. A implementação deve verificar o merge atual antes de assumir que os defaults resolvem.
- Dados corrompidos no `localStorage` podem quebrar o carregamento se `JSON.parse` for usado sem proteção.

## Decisões

- Abordagem escolhida: portar a página inteira e adaptar ao shell atual.
- Visibilidade: todos os usuários.
- Persistência: localStorage, sem banco nesta versão.
- Posição recomendada no menu: grupo `Operação`.
