# REPASSE CARE+
## Documento de contexto de negócio e base funcional para implementação

**Marca:** iPhone Repasse  
**Produto:** Repasse Care+  
**Versão:** 1.5 — 15/10/2026  
**Natureza:** especificação funcional de regras de negócio, **não** prompt, orçamento comercial nem definição de tecnologia.  
**Estado:** consolidação das decisões da conversa; itens ainda não definidos estão identificados como *pendentes*.

---

**Atualização 1.5:** incluídas referências às duas versões oficiais da identidade visual Repasse Care+ (fundo claro e fundo escuro), ambas em SVG vetorial transparente, sem alterar as regras comerciais.

**Atualização 1.4:** estabelecido como regra confirmada o token **numérico de seis dígitos**, enviado via CRM/WhatsApp e digitado **no link do contrato no celular**; geração e validação restritas ao backend. Permanecem configuráveis apenas os prazos, as tentativas e as rotinas de segurança.

## Identidade visual aprovada — arquivos oficiais

As duas versões abaixo são derivados vetoriais da identidade **Repasse Care+** fornecida pela iPhone Repasse. Preservar a composição aprovada (contorno minimalista de smartphone, ondas azuis e laranjas, símbolo `+`, lettering **REPASSE CARE+** e assinatura **by iPHONE REPASSE**). **Não redesenhar o símbolo, não substituir por escudo genérico e não aplicar estilo de IA ou efeitos 3D.**

| Contexto de aplicação | Arquivo no repositório | Caminho público no aplicativo |
|---|---|---|
| Fundo claro — texto e contorno em azul-marinho | [repasse-care-light.svg](../public/brand/repasse-care-light.svg) | `/brand/repasse-care-light.svg` |
| Fundo escuro — texto e contorno em branco | [repasse-care-dark.svg](../public/brand/repasse-care-dark.svg) | `/brand/repasse-care-dark.svg` |

**Especificações:** SVG vetorial escalável, fundo transparente, sem dependências de fontes externas. O aplicativo deve selecionar a versão adequada ao contraste do fundo, manter proporções e evitar distorção, recorte de lettering ou alterações na paleta. Os arquivos não representam uma nova proposta de logo; reproduzem a geometria da marca aprovada.

## 1. Visão do produto

O **Repasse Care+** será um programa de assistência continuada associado a aparelhos comercializados pela iPhone Repasse. A implementação precisa permitir que a empresa configure a oferta **por aparelho**, sem fixar preços, percentuais, franquias ou benefícios para todos os modelos. A **condição comercial do aparelho (novo ou seminovo)** é um eixo obrigatório da precificação: o mesmo modelo pode ter regras diferentes conforme sua condição.

**Princípio principal:** o sistema deve gerar as condições de contratação a partir das **configurações comerciais daquele aparelho** e do **valor efetivo de venda daquele aparelho na transação**.

A aplicação não deve tratar valores usados em simulações anteriores (como R$ 199, 3,5%, R$ 299 ou o preço de um iPhone específico) como regras globais, obrigatórias ou valores-padrão da operação.

## 2. Regra central — cobrança em duas etapas

Para cada aparelho elegível, o administrador precisa configurar independentemente:

1. **Valor da primeira parcela:** quantia fixa em reais, determinada para aquele aparelho/plano. É a cobrança inicial no momento da contratação. Pode ser identificada comercialmente como primeira parcela/adesão, **sem criar uma segunda taxa de adesão automaticamente**.
2. **Bônus vinculado à primeira parcela:** produto(s), serviço(s) ou benefício(s) concedidos quando a primeira parcela tiver sido confirmada como paga. Exemplo possível: capa premium e película premium. O bônus é **configurável**, não universal.
3. **Percentual das parcelas seguintes:** percentual informado pelo administrador e aplicado ao **valor de venda efetivo** do aparelho, não necessariamente ao preço de tabela ou ao valor de outro modelo.
4. **Quantidade das parcelas seguintes:** quantidade parametrizável para que a implementação não assuma equivocadamente se “12 parcelas” significa 12 no total ou 12 após a primeira. A configuração e o contrato devem exibir a distinção com clareza.

**Regra nova — percentual por condição:** é possível configurar o percentual das parcelas seguintes separadamente para todos os aparelhos **NOVOS** e para todos os **SEMINOVOS**. Quando houver um percentual específico para determinado **modelo + condição**, esse valor específico prevalece sobre o percentual geral da condição. A primeira parcela e seu bônus continuam personalizáveis por aparelho/modelo e condição.

### 2.1 Fórmulas obrigatórias

Variáveis:
- `P` = valor efetivamente praticado na venda do aparelho, em reais.
- `E` = valor configurado da primeira parcela, em reais.
- `r` = percentual aplicável para cada parcela seguinte, resolvido na hierarquia **modelo + condição → condição** (ex.: entrada de 3,5 significa 3,5%).
- `N` = quantidade de parcelas **posteriores** à primeira.
- `M` = valor monetário de cada parcela posterior.

Cálculos:

```text
M = arredondar_para_centavos(P × r / 100)
total_parcelas_posteriores = N × M
total_contrato_programado = E + total_parcelas_posteriores
quantidade_total_de_cobranças = 1 + N
```

Os valores são expressos em reais (BRL). O arredondamento monetário deve ser consistente, feito com representação decimal apropriada, não com ponto flutuante binário.

**Exemplo conceitual sem preços predefinidos:** se o preço efetivo da venda variar, o valor das parcelas posteriores deve ser recalculado sobre esse preço **no momento da contratação**. A primeira parcela continua no valor fixo configurado, independentemente dessa variação, salvo alteração explícita autorizada da condição comercial.

### 2.2 O que **não** fazer

- Não usar preço fixo de iPhone 13 ou de qualquer outro modelo como base do sistema.
- Não cobrar uma adesão extra além da primeira parcela, a menos que uma regra futura específica a autorize.
- Não calcular o percentual sobre custo de aquisição, custo da peça ou preço de catálogo quando houver preço efetivo de venda.
- Não interpretar o percentual como juros: ele é a fórmula de precificação de cada parcela do serviço.
- Não presumir que o valor ou o conteúdo do bônus é igual em todas as configurações.
- Não aplicar automaticamente novas condições comerciais a contratos já firmados.

## 3. Configuração comercial por aparelho

O painel administrativo deve oferecer a ação **“Configurar Repasse Care+”**, relacionada a um aparelho comercializado. O cadastro deve reconhecer **modelo/variante + condição (NOVO ou SEMINOVO)** como chave comercial; um mesmo modelo pode ter condições distintas. Além disso, devem existir **regras gerais por condição**, utilizadas para o percentual das parcelas seguintes e para a franquia quando não houver uma regra específica aplicável. Ajustes excepcionais por venda individual podem ser previstos com permissão específica, mas **não devem ser liberados sem uma decisão administrativa**.

### 3.1 Campos necessários

| Campo | Finalidade |
|---|---|
| Identificador da configuração | Chave própria e versão do conjunto de regras. |
| Aparelho/modelo/variante | Vincular a regra ao produto elegível no catálogo. |
| Condição (NOVO/SEMINOVO) | Diferenciar oferta do mesmo modelo conforme o estado comercial do aparelho. |
| Percentual geral por condição | Definir percentual padrão das parcelas seguintes para novos e, de forma independente, para seminovos. |
| Sobrescrita percentual por modelo + condição | Opcional; ao existir, prevalece sobre a regra geral da condição. |
| Ativo para contratação | Permite bloquear novas adesões sem afetar as existentes. |
| Valor da primeira parcela (`E`) | Valor absoluto definido pelo administrador. |
| Bônus da primeira parcela | Um ou mais benefícios cadastrados com descrição e condições de entrega. |
| Percentual das parcelas seguintes (`r`) | Percentual configurado para aquele aparelho. |
| Quantidade de parcelas seguintes (`N`) | Número de recorrências após a primeira cobrança. |
| Política de início e vencimento | Configuração do calendário de cobrança, sem datas presumidas. |
| Serviços e condições disponíveis | Referência ao catálogo de benefícios/serviços, quando forem definidos. |
| Franquia geral por condição | Definir, separadamente, a franquia percentual de aparelhos novos e seminovos. |
| Franquia específica por modelo + condição | Opcional; pode substituir a geral para aquela combinação, em valor fixo ou percentual. |
| Franquias por tipo de serviço | Extensão futura opcional: valores distintos por atendimento, sem presumir cobertura; **serviços ainda pendentes**. |
| Limites de utilização | Parâmetros configuráveis, sujeitos a definição comercial. |
| Vigência da regra | Data de ativação, versão e histórico de alterações. |

**Atenção:** o preço de venda (`P`) é atributo da **transação do aparelho** ou do contrato vinculado a ela. Não deve ser confundido com um preço global da configuração.

### 3.2 Hierarquia de aplicação das regras comerciais

1. Identificar o modelo/variante e a **condição de venda**: `NOVO` ou `SEMINOVO` (informação obrigatória; não inferir pelo nome do produto).
2. Recuperar a configuração elegível da **primeira parcela e do bônus** para **modelo/variante + condição**; não inventar um valor se estiver ausente.
3. Resolver o **percentual das parcelas seguintes**: **percentual específico de modelo + condição**, se configurado e ativo → caso contrário, **percentual geral da condição** (`NOVO` ou `SEMINOVO`).
4. Resolver a **franquia**: **regra específica de modelo + condição**, se configurada e ativa → caso contrário, **regra geral da condição**. Cada regra informa a modalidade de cálculo aplicável.
5. O preço **realmente praticado na venda** alimenta os cálculos percentuais. O sistema deve exibir o valor resultante e a **origem de cada regra** (específica ou geral).
6. Congelar preço, condição, valores, percentuais, origem e versão das regras no contrato (*snapshot comercial*). Uma alteração posterior não pode mudar contratos existentes.
7. Se faltar condição, primeira parcela, bônus obrigatório, percentual ou franquia necessária para uma proposta, apresentar a pendência ao administrador; **não aplicar zero nem um percentual de outra condição automaticamente**.

### 3.3 Percentual das parcelas posteriores: novo x seminovo

O administrador deve poder configurar **duas taxas independentes**, sem obrigatoriedade de igualdade:

- **Percentual padrão para aparelho novo**: taxa das parcelas posteriores aplicada ao preço de venda de qualquer iPhone novo, salvo exceção específica.
- **Percentual padrão para aparelho seminovo**: taxa das parcelas posteriores aplicada ao preço de venda de qualquer iPhone seminovo, salvo exceção específica.

O administrador também pode sobrescrever cada taxa em **modelo + condição**. Por exemplo, o mesmo modelo pode herdar a taxa de novo e usar taxa específica para seminovo. A diferença de capacidade/variante pode ser contemplada pelo catálogo sem exigir configuração distinta quando ela não existir.

**Fórmula:** `parcela_posterior = arredondar_centavos(preco_venda_efetivo × taxa_resolvida / 100)`.

### 3.4 Configuração da franquia: por condição ou por modelo + condição

A administração escolhe a granularidade da franquia:

- **Regra geral por condição:** percentual separado para **todos os iPhones novos** e para **todos os iPhones seminovos**. Aplica-se aos modelos daquela condição que não tenham regra específica.
- **Regra específica por modelo + condição:** franquia individual para um modelo **novo** ou para o mesmo modelo **seminovo**. Pode ser um **valor fixo em reais** ou **um percentual**. A configuração específica **substitui**, e não soma, a regra geral da condição.

Para cada registro de franquia, armazenar `escopo` (`CONDICAO` ou `MODELO_CONDICAO`), `condicao`, `modelo/variante` quando aplicável, `modalidade` (`PERCENTUAL` ou `VALOR_FIXO`), `valor`, vigência, versão e status ativo. Na tela, oferecer **"Herdar franquia por condição"** ou **"Definir franquia específica"**.

**Regra de negócio confirmada — base percentual da franquia:** a base de cálculo é obrigatoriamente o **valor efetivo de venda do aparelho na transação que originou o contrato do Repasse Care+**, congelado no momento da contratação (`preco_venda_efetivo_snapshot`). **Não** usar o preço de tabela, o preço atual de mercado, o custo da peça nem o valor do reparo como base de cálculo. A mesma regra se aplica às franquias percentuais gerais por condição e às percentuais específicas por modelo + condição. Franquias configuradas como **valor fixo** não são afetadas pelo preço de venda.

```text
se modalidade == PERCENTUAL:
    valor_franquia = arredondar_centavos(preco_venda_efetivo_snapshot * percentual_franquia / 100)
se modalidade == VALOR_FIXO:
    valor_franquia = valor_fixo_configurado
```

O sistema deve persistir no contrato tanto a **base de cálculo congelada** quanto o **percentual e valor da franquia resolvidos**, e mostrar esses elementos na proposta e nos detalhes do contrato. Alterações posteriores no preço de venda cadastrado ou nas regras do plano não recalculam uma franquia contratada.

```text
se franquia_especifica_ativa(modelo, condicao):
    regra_franquia = franquia_especifica(modelo, condicao)
senao:
    regra_franquia = franquia_geral(condicao)

se regra_franquia.modalidade == PERCENTUAL:
    valor_franquia = arredondar_centavos(preco_venda_efetivo_snapshot * regra_franquia.valor / 100)
senao:
    valor_franquia = regra_franquia.valor_em_reais
```

A franquia deve ser apresentada **antes da contratação** e no momento da solicitação de atendimento. A configuração de franquia **não cria por si só direito a determinado reparo**; a elegibilidade do serviço continuará definida em outro conjunto de regras.

## 4. Bônus inicial

O bônus está **vinculado à primeira parcela**, e não ao simples cadastro do cliente.

Regras:

1. O administrador escolhe qual benefício acompanha a primeira parcela daquele aparelho/configuração.
2. O benefício pode conter um item, um kit com múltiplos itens ou um serviço; o conteúdo deve estar discriminado na proposta.
3. O lançamento da contratação cria o direito ao bônus em estado **pendente**.
4. O pagamento confirmado da primeira parcela torna o bônus **liberado para entrega**.
5. O registro de entrega deve identificar a data, os itens/serviços entregues e o responsável.
6. Em caso de não pagamento, a concessão não deve ocorrer automaticamente.
7. O sistema deve evitar entrega duplicada em reprocessamentos de pagamentos ou integrações.
8. Disponibilidade de estoque, substituição de itens e reversão do benefício são políticas **a definir**, não pressuposições.

Exemplo de possibilidade de catálogo: *kit premium de capa + película*. Esse exemplo não deve ser transformado em bônus obrigatório de todos os aparelhos.

## 5. Contrato individual vinculado ao aparelho

Cada contratação do Repasse Care+ precisa estar relacionada a:

- Cliente responsável e identificador de cadastro.
- Aparelho adquirido, modelo/variante e, quando disponível, IMEI/número de série.
- Venda de origem, unidade/loja e valor efetivo de venda (`P`).
- Versão da configuração comercial selecionada.
- Primeiro pagamento (`E`) e seus dados de liquidação.
- Bônus prometidos, liberados e entregues.
- Condição comercial (`NOVO`/`SEMINOVO`), percentual resolvido (`r`), **origem da regra** (geral/específica), quantidade (`N`), valor (`M`) e calendário das demais parcelas.
- Regra e valor da franquia resolvidos (geral por condição ou específica por modelo + condição), sua modalidade, base percentual pactuada quando aplicável, e serviços elegíveis quando aprovados.
- Histórico de ações, alterações, cobranças e atendimentos.

A proposta ao cliente deve mostrar **separadamente**: primeira parcela, bônus inicial, valor de cada parcela seguinte, número de parcelas seguintes, total das cobranças programadas e serviços contratados. Deve ficar explícito quando o plano soma **1 primeira parcela + N parcelas posteriores**.

### Estados mínimos sugeridos para contrato

`rascunho` → `aguardando_assinatura` → `assinado_aguardando_primeiro_pagamento` → `ativo`; e, quando apropriado, `assinatura_expirada`, `assinatura_recusada`, `suspenso`, `encerrado` ou `cancelado`. A assinatura comprovada **não equivale** ao pagamento: a ativação depende também da confirmação da primeira parcela, conforme política de vigência a definir.

Esses estados são **estrutura técnica sugerida**, não definição antecipada de critérios de suspensão, cancelamento, cobertura ou reativação. Os gatilhos devem ser configurados/aprovados antes da automação operacional.

## 5.1. Assinatura eletrônica de contrato — regras confirmadas

**Decisão do proprietário:** o contrato será assinado eletronicamente, utilizando **token numérico de seis dígitos, de uso único, enviado pelo CRM ao WhatsApp do cliente**, que o digitará **na página segura de assinatura acessada por link no próprio celular**. A aplicação deverá registrar **logs de auditoria, localização quando disponível e autorizada, data e hora** e outras evidências que permitam demonstrar a autoria, a intenção de aceitar e a integridade do contrato. A assinatura deve fazer parte do fluxo normal de contratação do Repasse Care+, e não ser um arquivo avulso sem vínculo com venda, cliente ou aparelho.

A implementação deve priorizar uma trilha probatória robusta, sem presumir que o simples recebimento ou digitação de um código equivale a uma assinatura qualificada ICP-Brasil. O canal WhatsApp é um **fator de verificação de posse/acesso ao número** e precisa ser combinado com a identificação do contratante, a visualização do documento e a manifestação expressa de vontade.

### 5.2. Fluxo obrigatório de assinatura por token no WhatsApp

1. O vendedor conclui a proposta com todos os valores resolvidos, benefícios, franquia, condição do aparelho e dados do contratante; a proposta passa por validação antes do envio.
2. O sistema gera uma **versão imutável do contrato em PDF**, com identificador único, data de emissão, versão das cláusulas e **hash criptográfico SHA-256 dos bytes do PDF**. O preço, as condições e as regras são os snapshots já previstos no documento.
3. O cliente recebe **pelo CRM integrado ao WhatsApp** um **link de assinatura seguro e vinculado ao contrato**. A mensagem identifica iPhone Repasse/Repasse Care+ e informa que a confirmação representa assinatura contratual. O link não deve expor dados pessoais em parâmetros públicos.
4. No link, o cliente confere os seus dados, visualiza ou baixa **o contrato completo** e encontra resumo dos valores. Deve existir ação afirmativa, destacada e não pré-marcada: **“Li e concordo com o contrato [identificador/versão] e quero assinar eletronicamente.”** Aceite contratual não pode ser confundido com consentimento para publicidade.
5. O backend gera um **token numérico de exatamente seis dígitos, de uso único**. O CRM realiza apenas o envio desse código ao WhatsApp cadastrado do cliente (não faz a geração nem a validação do código). A aplicação registra tentativa de envio, status e identificador da mensagem retornados pelo provedor; entregar/enviar mensagem não significa assinar.
6. O cliente digita **os seis dígitos no campo de confirmação da página do contrato, aberta no celular**, **após o aceite expresso do texto contratual**. O backend verifica token, validade, tentativas, telefone, contrato, sessão e hash da versão do PDF; somente então gera o evento de assinatura.
7. O sistema registra atomicamente `contrato_assinado`, vincula as evidências e gera **comprovante/certificado de assinatura e PDF final**. Envia cópia ao WhatsApp do cliente ou link seguro de acesso, com a trilha de verificação; a entrega da cópia fica registrada.
8. O contrato prossegue para `assinado_aguardando_primeiro_pagamento`. A primeira parcela será cobrada/conferida; **somente após a confirmação do pagamento** a contratação segue para `ativo` e o bônus é liberado, conforme política comercial definida.
9. Se o cliente não aceitar, o token expirar ou ocorrer fraude/suspeita, não marcar como assinado. Permitir reenvio controlado, reinício de uma nova sessão ou atendimento manual auditado, **sem assinatura retroativa ou intervenção de vendedor em nome do cliente**.

**Regra de imutabilidade:** qualquer mudança no documento, valor, bônus, franquia, vencimento, aparelho ou titular **após geração do PDF** invalida a sessão de assinatura anterior; gerar **nova versão + novo hash + novo aceite + novo token**. Nenhum token pode ser reutilizado para outro documento ou versão.

### 5.3. Evidências e logs obrigatórios

Registrar em trilha **somente-adição (append-only)**, com identificação do evento e correlação ao contrato/versão/sessão:

| Evidência | Regra de registro |
|---|---|
| Cliente/assinante | ID interno, nome, CPF quando coletado legitimamente e telefone em formato internacional; mecanismos de checagem e eventuais divergências. |
| Venda e aparelho | Venda, loja/unidade, vendedor, modelo/condição, IMEI ou número de série quando existente, identificador do contrato. |
| Documento aceito | ID do PDF, versão exata, tamanho do arquivo, hash SHA-256, versão do texto de aceite e snapshot comercial. |
| WhatsApp | Número destinatário, provedor, ID de mensagem, momento de solicitação/envio e confirmações/erros do provedor; registrar origem do evento, sem guardar token em texto claro. |
| OTP | ID da sessão, criação, vencimento, número de tentativas, sucesso/falha, revogação e identificador de validação. **Nunca** armazenar o código bruto nem incluí-lo em logs. |
| Intenção inequívoca | Data/hora da disponibilização/visualização do documento, versão do aceite, clique explícito e validação do OTP. Registar como eventos distintos. |
| Data e hora | Horário de servidor confiável em **UTC, ISO 8601 com fuso**, e exibição convertida para `America/Fortaleza` no relatório. Nunca confiar exclusivamente no relógio do dispositivo. |
| Rede e dispositivo | IP da requisição **real** do aceite e validação do token, `user-agent`, identificador da sessão; encaminhamentos por proxy tratados de forma segura. Se não disponível, registrar ausência, não inventar. |
| Localização | Coordenadas/precisão/data da medição **apenas se o cliente autorizar conscientemente** acesso à geolocalização. Registrar permissão, origem e precisão. Sem autorização, marcar `nao_compartilhada`; não deduzir GPS de IP nem declarar localização exata. |
| Histórico | Eventos cronológicos de criação, envio, abertura, aceite, OTP, assinatura, falha, expiração, revogação e disponibilização da cópia. |
| Integridade e autoria técnica | Hash do PDF final, hash/assinatura do pacote de evidências, autorizações de acesso, identificação dos serviços responsáveis e logs de exportação/verificação. |

**Localização e privacidade:** a regra comercial é registrar localização como evidência **quando obtida de modo legítimo**. O aplicativo pode solicitar permissão de localização no ato; caso o cliente recuse ou o navegador não disponibilize a informação, o evento deve ficar claramente identificado e o fluxo **não deve fabricar coordenadas**. Não tornar a geolocalização precisa um bloqueio implícito da assinatura; eventual exigência obrigatória precisa ser expressamente aprovada e justificada segundo a necessidade da operação e a LGPD.

### 5.4. Segurança do token e da assinatura

- Token de uso único gerado por fonte criptograficamente segura; vinculado a **um contrato, uma versão imutável, um cliente/número e uma sessão**.
- **Definição confirmada pelo proprietário:** token numérico de **exatamente seis dígitos**. **Parâmetros técnicos sugeridos e configuráveis:** expiração inicial em cinco minutos e limite inicial de cinco tentativas. Apenas prazo e tentativas são sugestões técnicas; o comprimento de seis dígitos é decisão confirmada.
- Guardar só representação protegida do token (por exemplo, HMAC com chave privada no servidor); não expor código em URLs, arquivos, observabilidade, webhook ou resposta de suporte.
- Novo envio pode invalidar token anterior; configurar limites por número, IP, contrato e período; usar atraso progressivo e detecção de abuso.
- A verificação deve ser **servidor a servidor** no backend; nunca confiar em mera confirmação do frontend, captura de tela ou mensagem “OK” do vendedor.
- Rejeitar token expirado, já utilizado, de sessão cancelada, de documento alterado ou de outro telefone/contrato. Impedir concorrência/double submit e garantir **idempotência** do evento de assinatura.
- Proteger link de assinatura (TLS/HTTPS, token de acesso de curta duração, rate limiting), documento, dados e logs com controle de acesso, criptografia em repouso, backups e segregação entre funções de venda e auditoria.
- Eventos de auditoria devem ser **append-only/tamper-evident**, sem permissão de edição silenciosa por vendedor ou administrador comum; correções são novos eventos de retificação com motivo e autor.
- Confirmar que o WhatsApp informado pertence ao contratante por verificação de cadastro e identidade. **A posse do WhatsApp, isoladamente, não comprova identidade civil**; prever verificação complementar em caso de divergência ou risco.
- Integrar o **CRM existente** ao canal WhatsApp Business compatível com as políticas do provedor (modelos de mensagem quando exigidos, tratamento seguro de webhooks, autenticação/verificação de notificações e identificadores de mensagens). O backend de assinatura cria e verifica o token; o CRM é somente o **meio de entrega** do link e do código. Operadores do CRM não poderão acessar o token bruto.

### 5.5. Dossiê probatório, consulta e auditoria

Ao concluir a assinatura, manter um **dossiê associado ao contrato**, formado por:

1. PDF integral exato e imutável que o cliente aceitou, com identificador, versão e SHA-256.
2. Certificado/relatório de evidências em PDF ou formato exportável contendo signatário, telefone mascarado quando apropriado, carimbos de data/hora, IP, dados de localização se autorizados, status do OTP, ID da mensagem do provedor, histórico de eventos e método de assinatura.
3. Registro verificável de integridade do PDF e do dossiê; permitir ao auditor ou cliente comparar hash do documento com o registrado.
4. Registro de disponibilização/envio da cópia e histórico de acessos/exportações do documento.

O painel administrativo terá opções **“Ver contrato assinado”**, **“Ver trilha de auditoria”**, **“Baixar dossiê de assinatura”** e **“Verificar integridade”**, com acesso por função. O cliente poderá consultar ou receber sua cópia por canal seguro. Definir uma **política de retenção documentada e base legal de tratamento**, preservando provas enquanto necessário e evitando retenção indiscriminada de dados de localização, IP e identificadores pessoais.

### 5.6. Enquadramento técnico da assinatura e referências de conformidade

Objetivo de implementação: assinatura eletrônica com **comprovação de autoria, manifestação de vontade e integridade**, conforme a MP nº 2.200-2/2001, art. 10, § 2º, e princípios aplicáveis da LGPD (Lei nº 13.709/2018). O processo proposto **não deve ser anunciado como assinatura qualificada ICP-Brasil** por utilizar OTP; nem ser chamado automaticamente de assinatura avançada, pois essa classificação exige requisitos técnicos próprios. A validade e a força da prova dependem do fluxo realmente implementado e dos registros verificáveis.

Referências oficiais consultadas em 15/10/2026:
- MP nº 2.200-2/2001, art. 10: https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm
- Instituto Nacional de Tecnologia da Informação, diferenças entre assinaturas: https://www.gov.br/iti/pt-br/centrais-de-conteudo/opiniao-do-diretor-presidente/conheca-os-tipos-de-assinaturas-eletronicas-e-suas-diferencas-para-a-icp-brasil
- STJ, decisão de 18/03/2026 sobre contratos digitais sem ICP-Brasil: https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/2026/18032026-Terceira-Turma-valida-emprestimo-digital-com-assinatura-em-plataforma-nao-certificada-pela-ICP-Brasil.aspx
- ANPD, hipóteses legais e minimização no tratamento de dados: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse

### 5.7. Parâmetros operacionais a definir sem bloquear a estrutura-base

- Serviço/provedor de WhatsApp Business e credenciais de operação.
- Se a autenticação inicial exige CPF, data de nascimento ou outro fator, e método para checar titularidade do número.
- Texto final do aceite e modelo jurídico/versões das cláusulas; regras de armazenamento e compartilhamento do documento.
- Política definitiva de expiração/limite do OTP, acessibilidade e fluxo alternativo para cliente sem WhatsApp ou sem conectividade.
- Política de retenção de evidências e autorizações de geolocalização, com prazo e regra de descarte.
- Se haverá assinatura eletrônica adicional da empresa, e qual método será utilizado.

## 6. Cobrança, recorrência e integridade financeira

- A cobrança inicial usa o valor fixo `E`.
- As `N` cobranças subsequentes usam, cada uma, o valor `M` calculado sobre `P`.
- Não recalcular `M` a cada mês pela alteração do preço de tabela do aparelho: as parcelas contratadas devem manter o **snapshot** da venda e da configuração, salvo renegociação formal e rastreável.
- Registrar parcelas como programadas, emitidas, pagas, vencidas ou canceladas conforme a integração financeira.
- Evitar cobranças duplicadas e pagamento processado duas vezes (idempotência).
- Exibir o total contratado e o total já pago sem incluir o preço do aparelho como receita do plano.
- Modalidades de pagamento, datas de vencimento, juros, multas, inadimplência, renovação e política de cancelamento permanecem **pendentes de decisão**.

## 7. Assistência, acionamentos e franquias

O sistema deve estar preparado para gerenciar assistência por contrato e aparelho, **sem presumir que qualquer dano está automaticamente coberto**.

Estrutura funcional recomendada:

- Catálogo de tipos de atendimento (diagnóstico, manutenção, reparos etc.).
- Regras de elegibilidade por configuração/contrato.
- Franquia resolvida pela hierarquia **modelo + condição → condição**, em percentual ou valor fixo; possível especialização por tipo de atendimento somente se aprovada mais adiante.
- Registro de solicitação, análise, aprovação/reprovação, execução, custo real e conclusão.
- Controle de limites e histórico de atendimentos por contrato.
- Cadastro de custos de peça e serviço por modelo para indicadores gerenciais; esses custos **não** entram no cálculo do percentual cobrado ao cliente.

**Não aprovados até aqui:** quais reparos integram a assistência, franquias definitivas, limites quantitativos, carência, critério de aprovação e regras de acionamento antecipado. O desenvolvimento não deve inventar cobertura ou automatizar aprovação sem essa definição.

## 8. Painel administrativo e experiência de venda

### 8.1 Área administrativa

Módulos recomendados:

- **Aparelhos e regras do Care+**: configurar `E`, bônus e `N` por modelo + condição; configurar **percentuais gerais por condição (novo/seminovo)** e suas **sobrescritas por modelo + condição**; manter vigência e status.
- **Franquias**: cadastrar **percentual geral para novos** e **percentual geral para seminovos**, além de exceções por **modelo + condição** (valor fixo ou percentual); visualizar qual regra prevalece.
- **Catálogo de bônus**: criar kits, produtos, serviços e benefícios; definir conteúdo exibido na oferta.
- **Simulador comercial**: escolher aparelho e preço efetivo de venda; apresentar valores calculados, sem gravar contrato.
- **Contratos**: consultar adesões, versões de regras, cobranças, bônus e histórico.
- **Atendimentos**: gerenciar solicitações e serviços, quando essas regras forem definidas.
- **Financeiro**: acompanhar adesões, mensalidades, inadimplência, franquias e custos registrados separadamente.
- **Auditoria**: identificar o autor e o momento de cada alteração comercial.

### 8.2 Fluxo no momento da venda

1. Operador seleciona o aparelho e registra o preço final da venda.
2. Sistema identifica explicitamente **novo/seminovo**, encontra primeira parcela e bônus para o aparelho, e resolve **percentual e franquia** pelas hierarquias definidas.
3. Sistema exibe primeira parcela, bônus, percentual das seguintes, **origem do percentual**, quantidade, valor de cada seguinte, total e **franquia/modalidade aplicáveis**.
4. Cliente decide contratar ou não.
5. Sistema monta o PDF imutável do contrato e inicia o processo de **assinatura eletrônica via token enviado pelo WhatsApp**, com aceite explícito, validação de OTP e trilha de auditoria.
6. Somente depois de assinado, sistema registra `assinado_aguardando_primeiro_pagamento` e lança/solicita o primeiro pagamento.
7. Após confirmação do pagamento, ativa o contrato e libera o bônus, registrando sua entrega.
8. Demais parcelas seguem o calendário pactuado; PDF assinado e dossiê ficam disponíveis para consulta e auditoria.

## 9. Entidades lógicas para implementação

A modelagem física pode variar com a IDE, banco e arquitetura. Estrutura lógica sugerida:

```text
Device / DeviceVariant
Sale (device_variant_id, condition: NOVO|SEMINOVO, customer_id, final_sale_price,
      sale_date, imei_or_serial, store_id)
CarePlanRule (device_variant_id, condition, first_installment_amount,
              subsequent_installment_count, active, version, effective_from)
CareRecurringPercentRule (scope: CONDICAO|MODELO_CONDICAO, condition,
                          device_variant_id?, percent, active, version, effective_from)
CareDeductibleRule (scope: CONDICAO|MODELO_CONDICAO, condition,
                    device_variant_id?, modality: PERCENTUAL|VALOR_FIXO, value,
                    percent_base: PRECO_VENDA_EFETIVO, active, version, effective_from)
CareRuleBonus (care_plan_rule_id, benefit_id, quantity, delivery_condition)
Benefit (name, type, description, inventory_reference?)
CareContract (sale_id, customer_id, device_reference, condition_snapshot,
              sale_price_snapshot, first_amount_snapshot, percent_snapshot,
              percent_rule_source_snapshot, count_snapshot, recurring_amount_snapshot,
              deductible_rule_snapshot, deductible_value_snapshot,
              deductible_base_snapshot, total_snapshot, status)
ContractBenefit (care_contract_id, benefit_id, status, delivered_at, delivered_by)
ContractInstallment (care_contract_id, sequence_number, amount, due_date, status,
                     paid_at, payment_reference)
ServiceRequest (care_contract_id, service_type, status, deductible_amount?, actual_cost?)
CareAuditLog (actor_id, action, entity, before, after, created_at)
ContractDocument (contract_id, version, immutable_pdf_uri, pdf_sha256,
                  issued_at_utc, commercial_snapshot_ref, status)
ContractSignatureSession (contract_id, document_id, customer_id, whatsapp_number,
                          provider, session_status, otp_protected_verifier,
                          otp_expires_at_utc, attempt_count, accepted_terms_version,
                          accepted_at_utc, signed_at_utc)
ContractSignatureEvent (session_id, contract_id, document_id, event_type,
                        occurred_at_utc, source, actor_id_or_customer_ref,
                        source_ip?, user_agent?, whatsapp_message_id?,
                        geolocation_lat?, geolocation_lon?, accuracy_m?,
                        geolocation_permission_status?, event_data, evidence_hash)
ContractSignatureEvidence (contract_id, session_id, document_pdf_sha256,
                           evidence_package_uri, evidence_package_sha256,
                           exported_at_utc?, final_status)
```

Notas de implementação:

- `sequence_number = 1` representa **a primeira parcela fixa**.
- `sequence_number = 2 ... N+1` representa as parcelas calculadas pelo percentual.
- O bônus deve ser uma coleção, não uma única descrição textual, para permitir kits.
- Valores monetários precisam ser decimais e não negativos.
- O percentual deve ser validado como número não negativo e dentro de limites administrativos; limites comerciais definitivos ainda não foram estabelecidos.
- Alteração administrativa de regra gera nova versão, não reescrita de contratos antigos.
- Uma configuração específica por modelo + condição prevalece sobre a geral da condição **somente naquele parâmetro**; por exemplo, franquia específica não altera o percentual da mensalidade.
- Não misturar condição comercial (`NOVO`/`SEMINOVO`) com estado de conservação ou categoria genérica; manter os valores explícitos e auditáveis.
- Garantir no banco ausência de regras ativas sobrepostas para a mesma chave/escopo/período, ou uma política inequívoca de vigência e desempate.
- O banco deve vincular `ContractSignatureSession` a **um único `ContractDocument` imutável**; a sessão concluída deve impedir substituição do PDF original.
- Armazenamento dos logs e PDFs assinados deve ter controle por papéis, proteção contra adulteração e retenção documentada; não registrar OTP bruto.
- O estado `ativo` deve exigir **assinatura confirmada e pagamento inicial confirmado**, além das verificações de elegibilidade que forem aprovadas.

## 10. Indicadores de negócio

O painel pode consolidar, por modelo/variante e período:

- Quantidade de aparelhos vendidos e adesão ao Care+.
- Receita de primeiras parcelas e receita das parcelas posteriores, em separado.
- Valor contratado, efetivamente recebido e em atraso.
- Bônus liberados, entregues e seus custos (acesso gerencial).
- Atendimento/acionamento por modelo e por contrato.
- Receita de franquias e custos de reparos, quando aplicáveis.
- Margem e resultado operacional com premissas de custo explícitas.

Projeções devem ser identificadas como simulações, não confundidas com valores realizados.

## 11. Critérios objetivos de aceite

1. O administrador consegue criar duas regras para aparelhos diferentes com **primeiras parcelas distintas**.
2. Cada regra pode ter **bônus diferentes**, inclusive um kit composto.
3. Cada regra pode ter **percentual diferente** para parcelas posteriores.
4. Para o mesmo modelo/configuração, duas vendas com preços finais diferentes geram parcelas posteriores diferentes, proporcionais ao preço efetivo de cada venda.
5. A alteração do percentual de um modelo não modifica parcelas já contratadas anteriormente.
6. O sistema exibe quantas parcelas são posteriores à inicial, sem ambiguidade.
7. O bônus não é marcado como liberado antes da confirmação do pagamento inicial.
8. Uma confirmação duplicada de pagamento não gera bônus ou cobrança duplicada.
9. Uma venda de aparelho sem regra ativa não recebe preço de proteção inventado.
10. Valores históricos de simulações não aparecem como parâmetros obrigatórios no código nem em novos cadastros.
11. O sistema separa receitas da venda do iPhone das receitas do Repasse Care+.
12. Há um percentual geral de mensalidade para **NOVO** e outro independente para **SEMINOVO**.
13. Dois aparelhos do **mesmo modelo**, um novo e um seminovo, podem ter parcelas percentuais diferentes.
14. Uma taxa específica de **modelo + condição** substitui apenas a taxa geral daquela condição; os demais aparelhos continuam herdando a taxa geral.
15. Há franquias gerais **percentuais** independentes para novo e seminovo.
16. Para uma combinação **modelo + condição**, o administrador pode escolher franquia específica **fixa ou percentual**.
17. Quando existir franquia específica, ela **substitui**, sem somar, a franquia geral; na ausência dela, a franquia geral é herdada.
18. Uma mudança no percentual ou franquia geral de aparelhos novos não modifica a configuração de seminovos nem contratos já firmados.
19. Contrato e proposta registram **condição, regra efetiva, origem da regra, modalidade e valor calculado da franquia**.
20. O sistema bloqueia contratação quando falta condição ou regra necessária, em vez de usar valores implícitos.
21. A franquia geral percentual para `NOVO` é calculada sobre o preço **efetivamente praticado na venda** de cada aparelho novo; o mesmo vale para `SEMINOVO`.
22. A franquia específica percentual de `modelo + condição` utiliza a **mesma base**, ainda que o preço de venda seja diferente para dois aparelhos do mesmo modelo.
23. Franquia **fixa** permanece igual ao valor configurado, independentemente do preço de venda.
24. O sistema preserva a base e o valor da franquia na contratação; alterar preço cadastrado, taxa ou regra posterior não altera o contrato anterior.
25. O CRM envia ao cliente no WhatsApp um **link seguro e um token numérico de exatamente seis dígitos**, vinculado a **seu contrato, versão, telefone e sessão**; o cliente digita o token **na página do contrato no celular**, e o simples envio/recebimento do token não assina.
26. O sistema exige **visualização/disponibilização do documento integral e aceite afirmativo** antes de validar o token e concluir a assinatura.
27. Tentativas inválidas, expiração, revogação e reenvio são rastreados; o token não aparece em logs e não pode ser reutilizado.
28. O documento aceito tem hash SHA-256 verificável. Qualquer alteração gera novo documento, novo aceite e nova sessão/token.
29. O dossiê permite consultar hora do servidor UTC, exibição Fortaleza, IP e `user-agent` da interação, telefone/identificação, ID do WhatsApp, eventos cronológicos e localização quando compartilhada legitimamente.
30. Ao negar acesso à localização, o sistema registra `nao_compartilhada` e não cria coordenadas fictícias.
31. A assinatura concluída gera PDF final e relatório de evidências imutáveis, exportáveis e vinculados à venda e ao aparelho.
32. A assinatura não ativa benefício nem libera bônus antes da confirmação do primeiro pagamento.
33. Vendedor ou administrador não conseguem editar silenciosamente o documento assinado, nem assinar pelo cliente usando o painel.

## 12. Registro de decisões

### Confirmadas pelo proprietário nesta conversa

- Nome do programa: **Repasse Care+**.
- Vinculação comercial à **iPhone Repasse**.
- A solução deve trabalhar com **regras configuráveis por aparelho**, e não com exemplo fixo de iPhone 13.
- O administrador deve escolher **o valor da primeira parcela por aparelho**.
- O administrador deve escolher **qual bônus acompanha a primeira parcela**.
- O percentual das parcelas seguintes pode ser definido **por condição: novo ou seminovo**.
- O percentual das parcelas seguintes pode ser especificado também **por modelo + condição**, prevalecendo sobre a regra geral quando configurado.
- A franquia pode ser definida **por modelo + condição** ou **de forma geral por condição**.
- A franquia geral pode ser **um percentual para todos os novos** e **outro para todos os seminovos**.
- As parcelas seguintes devem ser calculadas como **percentual configurável do valor de venda efetivo do aparelho**.
- **Toda franquia definida em percentual incide sobre o valor efetivo de venda do aparelho**, tanto nas regras gerais por condição quanto nas regras específicas de modelo + condição. Essa base fica congelada no contrato.
- O kit premium de capa e película é um **exemplo de bônus inicial**, não um item obrigatório para todas as configurações.
- **A assinatura do contrato será eletrônica, com token numérico de exatamente seis dígitos, gerado e validado no backend, entregue via CRM/WhatsApp e digitado pelo cliente no link de assinatura aberto no celular.**
- **O processo de assinatura deverá guardar logs, data, hora e localização quando compartilhada/autorizada, além de evidências de aceitação e integridade.**

### Recomendações técnicas incorporadas como propostas, não decisões comerciais

- Quantidade de parcelas posteriores configurável.
- Versões de regras, snapshots contratuais, auditoria e idempotência.
- Controle de bônus por estado de pagamento/entrega.
- Hierarquia sem somatório: **específica por modelo + condição → geral por condição**, com rastreabilidade da origem.
- Franquia individual configurável em valor fixo ou percentual, além das franquias gerais percentuais.
- Catálogo de serviços, franquias e relatórios preparados para parametrização.
- Documento contratual imutável, aceite explícito, hash SHA-256, sessão de OTP, eventos append-only e dossiê de assinatura exportável.
- Dados de localização acessados apenas mediante permissão; recusa registrada sem alegação falsa de coordenadas.

### Ainda pendentes de definição de negócio

- Quantidade padrão de parcelas posteriores e calendário de vencimentos.
- Se o bônus pode ser modificado manualmente numa contratação individual e por quais perfis.
- Política de quais serviços são elegíveis, possíveis diferenciações de franquia por serviço e eventuais limites.
- Carência, elegibilidade para aparelhos já vendidos e verificação técnica.
- Regras de renovação, cancelamento, inadimplência, suspensão e reativação.
- Política de transferência da proteção para outro aparelho ou proprietário.
- Canais de contratação distintos da **assinatura via WhatsApp já confirmada** e meios de cobrança.
- Provedor de WhatsApp, verificação complementar de identidade, retenção das provas, política final de OTP, fluxos de exceção.

---

## 13. Síntese de implementação

> **A regra não é “iPhone 13 custa X e paga Y”. A regra é: para cada aparelho e sua condição (novo/seminovo), a administração define o valor da primeira parcela e o bônus associado; para as demais parcelas, o sistema usa a taxa por modelo + condição, quando houver, ou a taxa geral de novo/seminovo; a franquia também admite regra específica por modelo + condição ou geral por condição, e **toda franquia percentual incide sobre o valor efetivo de venda da transação**. No fechamento da venda, o sistema calcula parcelas e franquias percentuais sobre esse preço, mostra as regras aplicadas e preserva no contrato as condições da contratação.**

**Assinatura obrigatória no fluxo:** a proposta vira documento imutável, o cliente o visualiza e aceita, recebe pelo CRM/WhatsApp um código numérico de seis dígitos e o informa na página do contrato em seu celular; somente a validação bem-sucedida gera assinatura com evidências auditáveis. O dossiê guarda hash, logs, horário, IP, origem das mensagens e localização **se autorizada**, sem inventar dados quando ausentes. Um contrato assinado não vira ativo antes do pagamento inicial confirmado.

Este documento é a fonte de contexto de negócio a ser levada à IDE local. Ele descreve o comportamento esperado e delimita o que ainda depende de decisão, sem escolher linguagem, framework ou banco de dados.