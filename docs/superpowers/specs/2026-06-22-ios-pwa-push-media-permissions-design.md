# Design: Web Push e permissões de mídia dos PWAs no iOS

**Data:** 2026-06-22  
**Produtos:** iPhoneRepasse Pro ERP e CRM Plus  
**Status:** aprovado para planejamento  
**Abordagem escolhida:** modernização progressiva e retrocompatível

## 1. Objetivo

Modernizar o Web Push e os fluxos de notificações, câmera, microfone e seleção
de fotos dos dois PWAs, preservando o funcionamento atual e respeitando as
restrições reais do iOS/WebKit.

O trabalho deve:

- manter o Service Worker atual como fallback para navegadores existentes;
- adicionar Declarative Web Push para Safari/iOS 18.4 ou superior;
- continuar suportando o Web Push tradicional no iOS/iPadOS 16.4 ou superior;
- solicitar permissões somente após uma ação explícita da pessoa;
- separar corretamente ERP e CRM Plus;
- manter apenas os produtores de notificação que já existem;
- documentar separadamente variáveis públicas da VPS e secrets do Supabase
  Cloud;
- não criar permissões fictícias para recursos que a plataforma web não expõe.

## 2. Escopo confirmado

### 2.1 Eventos push do ERP

O ERP continuará enviando somente:

- `sale`: venda concluída.

Os tópicos `finance_due` e `stock_alert` podem permanecer no catálogo por
compatibilidade, mas não receberão novos produtores ou agendamentos neste
trabalho. A interface não deve prometer que esses alertas já são enviados.

### 2.2 Eventos push do CRM Plus

O CRM Plus continuará enviando:

- `crm_inbox`: nova mensagem recebida;
- `new_lead`: novo lead;
- `transfer_pending`: atendimento transferido pela IA e aguardando humano.

### 2.3 Recursos de mídia

- ERP: câmera e seletor de fotos no cadastro/edição de estoque e na troca do
  PDV, ambos via `StockFormModal`.
- CRM Plus: microfone para mensagens de voz e seletor de imagens/vídeos no
  compositor de conversas.

## 3. Requisitos atuais do iOS e WebKit

### 3.1 Web Push tradicional

No iOS e iPadOS 16.4 ou superior:

- o site precisa estar adicionado à Tela de Início como web app;
- o manifesto deve usar `display: standalone` ou `fullscreen`;
- a solicitação de notificação deve decorrer de interação direta da pessoa;
- a subscription deve usar `userVisibleOnly: true`;
- cada evento push precisa resultar em uma notificação visível;
- a pessoa gerencia a permissão nas configurações de Notificações do iOS.

O projeto já atende a maior parte desses requisitos: manifests independentes,
detecção de standalone, solicitação contextual, VAPID, criptografia
`aes128gcm`, subscriptions por produto e fallback visível no Service Worker.

### 3.2 Declarative Web Push

Desde o iOS/iPadOS 18.4, o WebKit suporta Declarative Web Push. O payload passa
a descrever a notificação em um formato padronizado:

```json
{
  "web_push": 8030,
  "notification": {
    "title": "Título obrigatório",
    "body": "Mensagem",
    "navigate": "https://destino.example/rota",
    "silent": false,
    "app_badge": "1"
  }
}
```

Esse formato é compatível com o Web Push existente. Em navegadores novos, o
browser tem informação suficiente para mostrar uma notificação mesmo se o
Service Worker falhar ou for removido. Em navegadores antigos, o Service Worker
continua recebendo o JSON e deve interpretá-lo.

O Service Worker pode mostrar uma notificação substituta. Quando isso acontece
corretamente em um browser com Declarative Web Push, a proposta declarativa é
ignorada, evitando duplicidade.

### 3.3 Câmera e microfone

`navigator.mediaDevices.getUserMedia()` é a API que gera a autorização
persistente de câmera ou microfone para a origem. Ela deve ser chamada em
contexto seguro e como consequência direta de uma ação da pessoa.

Um `<input type="file" capture="environment">` não equivale a conceder acesso
geral e persistente à câmera. Ele abre uma experiência nativa para capturar ou
selecionar um arquivo. O produto deve descrever esse comportamento com precisão,
sem simular um estado de permissão que não consegue observar.

### 3.4 Fototeca

Uma PWA não recebe uma permissão geral equivalente ao acesso completo à
Fototeca de um aplicativo nativo. O seletor de arquivos/fotos do sistema entrega
somente os itens escolhidos pela pessoa.

Consequentemente:

- não existe `Notification.permission` ou `PermissionStatus` equivalente para
  “fototeca” nesse fluxo;
- o app não deve mostrar “Fotos autorizadas” ou “Fotos bloqueadas” como se
  houvesse uma permissão persistente;
- o texto deve explicar que apenas as imagens selecionadas serão entregues;
- cancelar o seletor não é negar uma permissão.

## 4. Estado atual e lacunas

| Área | Estado atual | Lacuna |
|---|---|---|
| Criptografia Web Push | RFC 8291 `aes128gcm` implementada | Nenhuma alteração criptográfica necessária |
| Isolamento de produto | `product=erp\|crmplus`, tópicos e cache separados | O vetor legado `#/crmplus` ainda existe para compatibilidade |
| Service Worker | Sempre chama `showNotification` e força `silent:false` | Payload ainda não usa o formato declarativo |
| Badge | SW aceita `badgeCount` | Produtores atuais não calculam um contador confiável |
| ERP | Venda concluída chama `sales-notify` | UI ainda anuncia financeiro/estoque sem produtores |
| CRM | WhatsApp, Instagram, lead e handoff enviam push | Deve migrar o payload para o contrato declarativo |
| Notificações | Pré-explicação e gesto explícito existem | Há componentes/cópias parcialmente duplicados |
| Microfone CRM | Pré-explicação seguida de `getUserMedia` | O stream é aberto e fechado antes de o gravador abrir outro |
| Câmera ERP | Pré-explicação seguida de `input capture` | UI trata o fluxo como permissão persistente |
| Fototeca | Pré-explicação seguida do seletor nativo | Copy chama o seletor de “acesso à biblioteca” |
| Configurações CRM | Exibe estados de câmera/microfone/notificações | Não explica a natureza não persistente da fototeca |
| Variáveis | Parte já documentada em `.env.example` | VPS e Supabase Cloud não estão claramente separados |

## 5. Arquitetura proposta

### 5.1 Contrato único de notificação

O backend continuará recebendo o modelo interno atual:

```ts
type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
};
```

Antes da criptografia, `push-send` converterá esse modelo para um envelope
declarativo:

```ts
type DeclarativePushEnvelope = {
  web_push: 8030;
  notification: {
    title: string;
    body?: string;
    navigate: string;
    lang: "pt-BR";
    dir: "ltr";
    silent: false;
    tag?: string;
    icon?: string;
    badge?: string;
    requireInteraction?: boolean;
    app_badge?: string;
  };
};
```

Regras:

- `title` permanece obrigatório e não vazio;
- `navigate` deve ser URL absoluta, segura e pertencente ao ERP ou CRM Plus;
- `silent` será sempre `false`;
- o corpo continuará cifrado com RFC 8291;
- `app_badge` só será enviado quando houver um contador real;
- não será inventado um contador apenas para demonstrar a API.

### 5.2 Compatibilidade do Service Worker

O handler `push` aceitará:

1. o novo envelope `payload.notification`;
2. o payload plano legado;
3. texto ou payload inválido, usando o fallback atual.

Para o envelope declarativo, o SW mapeará:

- `notification.title` para o título;
- `notification.navigate` para `data.url`;
- `notification.app_badge` para atualização do Badging API;
- demais propriedades visuais para `showNotification`.

O `notificationclick` continuará focando ou abrindo a rota do produto correto.
No host dedicado do CRM Plus, URLs absolutas devem permanecer absolutas.

### 5.3 Isolamento dos PWAs

- ERP: origem principal, manifesto `/app.webmanifest`, `product="erp"`.
- CRM Plus: origem dedicada `crm.iphonerepasse.com.br`, manifesto
  `/crm.webmanifest`, `product="crmplus"`.
- `#/crmplus` permanece somente como compatibilidade para usuários antigos.
- O vetor legado não oferecerá instalação nem criação de nova subscription.
- Nenhum push do CRM pode atingir uma subscription ERP e vice-versa.

### 5.4 Camada compartilhada de permissões

O frontend terá um contrato comum para explicar e iniciar ações protegidas:

```ts
type DeviceCapability =
  | "notifications"
  | "camera-capture"
  | "microphone"
  | "photo-picker";

type CapabilityActionResult =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "denied"; guidance: string }
  | { status: "unsupported"; guidance: string }
  | { status: "failed"; message: string };
```

O componente visual deve:

- aparecer apenas depois que a pessoa escolhe usar o recurso;
- explicar o motivo em linguagem curta e específica ao produto;
- ter CTA principal com o nome da ação real;
- ter opção de cancelar sem coerção;
- iniciar a API/seletor nativo no callback direto do CTA;
- mostrar instruções de recuperação quando houver bloqueio persistente.

## 6. Fluxos de interface

### 6.1 Notificações no ERP

1. A pessoa abre “Configurações → Notificações”.
2. Se estiver no Safari e não instalado, o app explica como adicionar à Tela de
   Início e não chama `Notification.requestPermission()`.
3. Ao tocar em “Ativar notificações”, abre a explicação do ERP.
4. Ao tocar em “Continuar”, o app chama o alerta nativo de notificação.
5. Em `granted`, cria/sincroniza a subscription `product="erp"`.
6. A UI oferece apenas o tópico efetivamente produzido: venda concluída.
7. Em `denied`, mostra “Ajustes → Notificações → iPhoneRepasse Pro”.

O banner automático continuará sendo apenas um convite para abrir esse fluxo;
ele nunca chamará a permissão nativa durante carregamento.

### 6.2 Notificações no CRM Plus

1. Fora do modo standalone, a pessoa recebe instruções para instalar o CRM Plus
   pelo host dedicado.
2. Dentro do PWA, o botão “Ativar notificações” abre a explicação do CRM.
3. “Continuar” dispara o alerta nativo.
4. Em `granted`, cria/sincroniza a subscription `product="crmplus"` com
   `crm_inbox`, `new_lead` e `transfer_pending`.
5. Em `denied`, mostra “Ajustes → Notificações → CRM Plus”.

O lembrete dispensado deve usar a mesma janela de 14 dias do ERP e chave
namespaced por produto.

### 6.3 Câmera no ERP

1. A pessoa toca em “Adicionar foto”.
2. Escolhe “Abrir câmera”.
3. O app explica que a câmera será aberta para fotografar o aparelho.
4. O CTA “Abrir câmera” aciona imediatamente o input com
   `capture="environment"`.
5. O sistema abre a experiência nativa disponível.
6. A foto só entra na fila depois da escolha/confirmação da pessoa.
7. Cancelar retorna ao formulário sem erro ou estado “negado”.

O frontend não mostrará um badge persistente “Câmera autorizada” para esse
fluxo baseado em file input. Se no futuro houver uma câmera ao vivo via
`getUserMedia({video:true})`, essa funcionalidade terá seu próprio estado de
permissão.

### 6.4 Microfone no CRM Plus

1. A pessoa toca no botão de gravar áudio.
2. Se a permissão não estiver confirmada, abre a explicação.
3. “Ativar microfone” chama uma única vez
   `getUserMedia({audio:true})`.
4. O stream retornado é entregue ao `AudioRecorder`.
5. O gravador não abre um segundo stream quando recebeu um stream válido.
6. Ao cancelar, enviar, fechar ou ocorrer erro, todas as tracks são encerradas.
7. Em bloqueio, mostra orientação para os ajustes do site/PWA no iOS.

### 6.5 Fotos e vídeos no CRM Plus

1. A pessoa toca em anexar mídia.
2. O app explica que o seletor do iPhone será aberto e somente os arquivos
   escolhidos serão compartilhados.
3. “Escolher fotos e vídeos” abre o input nativo.
4. Cancelar fecha o seletor sem produzir erro.
5. Arquivos escolhidos passam pelas validações atuais de quantidade, tipo e
   tamanho antes do upload.

Esse fluxo não será apresentado como uma permissão persistente.

### 6.6 Configurações de permissões

ERP e CRM Plus devem distinguir:

- **Notificações:** estado persistente observável.
- **Microfone:** estado observável quando o browser expõe a Permissions API;
  caso contrário, “Solicitado ao gravar”.
- **Câmera de captura:** “Aberta somente quando você escolhe fotografar”.
- **Fotos e vídeos:** “Somente itens escolhidos no seletor”.

## 7. Backend e Supabase Cloud

Não será criada migration neste escopo. A tabela `push_subscriptions`, a coluna
`product`, os índices e as políticas RLS atuais serão preservados.

Edge Functions afetadas:

- `push-send`: gerar o envelope declarativo antes de cifrar;
- testes de `push-send`: validar envelope, URL, título, silêncio e fallback;
- os produtores atuais continuam chamando `push-send` pelo modelo interno, sem
  duplicar a transformação.

Produtores preservados:

- `sales-notify`;
- `_shared/crm_push.ts`;
- `crm-uaz-webhook-receiver`;
- `crm-instagram-webhook-receiver`;
- `crm-ai-inbound`.

As chamadas server-to-server continuam autenticadas por service role ou
`PUSH_WORKER_SECRET`. Nenhuma secret será enviada ao cliente.

## 8. Variáveis e secrets

### 8.1 VPS — build e frontend públicos

Obrigatórias:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-ou-anon-key>
VITE_VAPID_PUBLIC_KEY=<chave-publica-vapid>
VITE_CRM_HOSTNAME=crm.iphonerepasse.com.br
VITE_CRM_BASE_URL=https://crm.iphonerepasse.com.br
```

Regras:

- tudo com prefixo `VITE_` é incorporado ao bundle e deve ser considerado
  público;
- `VITE_VAPID_PUBLIC_KEY` deve corresponder à chave pública associada à secret
  privada usada pelo Supabase Cloud;
- nunca colocar `VAPID_PRIVATE_KEY`, `PUSH_WORKER_SECRET` ou service role na VPS
  quando ela serve apenas o frontend estático.

### 8.2 Supabase Cloud — Edge Function secrets

Configurar pelo dashboard ou CLI:

```env
VAPID_PRIVATE_KEY=<chave-privada-vapid>
VAPID_PUBLIC_KEY=<mesma-chave-publica-da-vps>
VAPID_SUBJECT=mailto:<email-operacional>
CRM_BASE_URL=https://crm.iphonerepasse.com.br
CRM_HOSTNAME=crm.iphonerepasse.com.br
PUSH_WORKER_SECRET=<segredo-aleatorio-forte>
```

Disponíveis automaticamente nas Edge Functions hospedadas:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Essas variáveis automáticas não devem ser copiadas para o bundle além da URL e
da chave pública/anonima explicitamente destinadas ao frontend.

## 9. Tratamento de erros

- Sem suporte a push: explicar a limitação sem renderizar controle quebrado.
- iOS não instalado: direcionar para instalação, sem solicitar push.
- Permissão negada: não repetir o alerta; mostrar recuperação nos Ajustes.
- Subscription expirada: manter a desativação automática em HTTP 404/410.
- Falha temporária do push service: manter retry e backoff atuais.
- Payload inválido: Service Worker mostra fallback visível.
- Microfone negado ou indisponível: não iniciar o gravador.
- Seletor de câmera/fotos cancelado: tratar como cancelamento, não como erro.
- Upload inválido: preservar validações atuais e informar a causa concreta.

## 10. Testes e verificação

### 10.1 Testes automatizados

- unitários do builder do envelope Declarative Web Push;
- round-trip RFC 8291 existente;
- Service Worker com payload declarativo, legado e inválido;
- nenhuma duplicação lógica no handler;
- URL absoluta correta para ERP e CRM Plus;
- subscription e tópicos separados por produto;
- ERP exibindo somente o tópico de venda efetivamente produzido;
- CRM exibindo os três tópicos atuais;
- microfone usando um único stream e encerrando todas as tracks;
- câmera e seletor de fotos chamados somente após CTA;
- cancelamento de file picker sem erro;
- copy sem afirmar acesso geral à Fototeca.

### 10.2 Verificação técnica

Executar:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run test:deno
npm run build
```

### 10.3 Verificação manual em dispositivo

Em um iPhone/iPad real:

- iOS 16.4 ou superior para fallback tradicional;
- iOS 18.4 ou superior para Declarative Web Push;
- ERP e CRM Plus instalados separadamente;
- permissão acionada somente após toque;
- notificação recebida com app fechado;
- clique abrindo o produto e a rota corretos;
- venda chegando somente ao ERP;
- mensagens, lead e handoff chegando somente ao CRM;
- microfone abrindo um único fluxo nativo;
- câmera e seletor compartilhando somente os arquivos escolhidos.

## 11. Fora do escopo

- criar disparos para contas a vencer;
- criar alertas automáticos de estoque;
- introduzir push de marketing;
- criar câmera ao vivo customizada;
- solicitar acesso geral à Fototeca;
- remover imediatamente o vetor legado `#/crmplus`;
- alterar RLS ou schema de `push_subscriptions`;
- realizar deploy das Edge Functions ou configurar secrets sem autorização
  específica.

## 12. Fontes oficiais

- WebKit, “Web Push for Web Apps on iOS and iPadOS”, 16 de fevereiro de 2023:
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- WebKit, “Meet Declarative Web Push”, 27 de março de 2025:
  https://webkit.org/blog/16535/meet-declarative-web-push/
- Apple Human Interface Guidelines, “Privacy”:
  https://developer.apple.com/design/human-interface-guidelines/privacy
- Supabase, “Environment Variables” para Edge Functions:
  https://supabase.com/docs/guides/functions/secrets

