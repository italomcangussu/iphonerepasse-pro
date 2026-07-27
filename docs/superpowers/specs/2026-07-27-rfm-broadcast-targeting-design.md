# Segmentação RFM para Broadcasts — Design

**Data:** 2026-07-27

## Objetivo

Permitir que uma campanha criada em Marketing envie somente para os contatos CRM
dos clientes pertencentes a um segmento RFM da loja ativa, sem degradar para um
disparo para toda a base.

## Evidências e causa raiz

- `CampaignsTab` calcula RFM com todas as vendas, apesar de o broadcast operar
  em uma única `store_id`.
- O formulário de broadcast só conhece os filtros genéricos `is_customer` e
  `funnel_stage`; o worker e a RPC `prepare_broadcast_recipients` ignoram
  qualquer noção de segmento RFM.
- O banco já possui a ponte correta: `sales.crm_lead_id` é preenchido pelo
  resolvedor conservador de CRM, que prioriza a mesma loja e não escolhe um
  candidato ambíguo. `crm_leads.customer_id` é um enriquecimento adicional,
  mas o vínculo da venda é a origem mais direta para congelar a audiência.

## Decisão

O navegador resolve o segmento RFM com as vendas da loja ativa e monta uma
lista deduplicada de `crm_lead_id`, escolhendo o vínculo da venda mais recente
de cada cliente. Essa lista é gravada em `recipient_filters.lead_ids` no
rascunho, junto a `rfm_segment` apenas para auditoria humana.

`lead_ids` é uma audiência explícita e fechada. Quando a chave existe:

- uma lista vazia é inválida;
- a RPC SQL e o worker consultam apenas os IDs da lista e sempre combinam com
  `store_id`;
- nenhum código pode cair nos filtros genéricos nem incluir leads adicionais.

O limite de 500 contatos já existente no worker é aplicado antes de salvar o
rascunho. A resolução ordena o segmento por valor gasto, portanto, quando a
base excede o limite, entram os 500 clientes de maior valor e a interface diz
isso explicitamente.

O histórico de vendas é paginado em blocos de 1.000 linhas antes do cálculo.
Assim, o RFM e a lista congelada não param no limite padrão do Data API.

## Interface

O modal passa a oferecer “Segmento RFM da loja”. Ao selecionar essa opção, o
usuário escolhe um dos segmentos disponíveis e vê, antes de salvar:

- total de clientes no segmento;
- contatos CRM vinculados que serão incluídos;
- clientes sem vínculo CRM que ficarão de fora;
- o aviso de limite, se aplicável.

Salvar é bloqueado quando não há nenhum contato vinculável. Erros ficam
inline; o rascunho salvo recebe confirmação visível.

## Escopo e segurança

- Não cria tabelas, políticas ou novos endpoints públicos.
- Reutiliza `sales.crm_lead_id`, já mantido no banco com regras de
  desambiguação e escopo de loja.
- A migration apenas substitui a função de preparo existente. Ela continua
  `security definer` com `search_path` fixo e não recebe novas permissões.
- O worker usa o mesmo contrato de filtro para sua preparação de contingência.
- Não há deploy nem alteração na instância remota nesta tarefa; a migration
  fica pronta para aplicação pelo fluxo do repositório.

## Fora de escopo

- Personalização de texto por destinatário.
- Recuperação automática de clientes sem `crm_lead_id` ambíguo.
- Alteração da rota/provedor de envio UAZApi ou Instagram.
