# Inventory Floating Special Share Design

## Context

Na aba Estoque do PWA iOS, o modo "Lista especial" permite selecionar aparelhos filtrados e gerar um texto de compartilhamento com valores e parcelamento para WhatsApp ou Instagram. O componente de seleção precisa ficar visível enquanto o usuário rola a lista, mantendo a posição visual abaixo da header.

## Approved Direction

Usar a opção B do mockup: um painel flutuante abaixo da header, com aparência de superfície iOS translúcida, contador de itens selecionados, destino da lista e ações principais.

## Behavior

- O painel aparece somente quando `isSpecialShareMode` estiver ativo.
- O painel fica `fixed` e desacoplado do corpo da lista, usando safe area do iOS.
- A posição deve ficar abaixo da header real do app, não no topo absoluto da tela.
- Ao rolar o estoque, o painel permanece visível.
- O conteúdo da lista recebe respiro superior enquanto o painel está ativo para evitar que os primeiros cards fiquem escondidos.
- O botão "Escolher parcelas" permanece desabilitado até existir pelo menos um aparelho selecionado.
- O menu de parcelas continua ancorado ao botão, com limite de altura e rolagem própria.
- "Cancelar" encerra o modo especial e limpa a seleção como hoje.

## Visual System

- Paleta preserva os tokens atuais de marca: `brand` azul para ação, superfícies brancas translúcidas, bordas brand suaves e sombra iOS.
- O traço distintivo é uma pequena faixa lateral verde quando o canal for WhatsApp, conectando visualmente o painel ao destino comercial sem transformar a tela em uma peça promocional.
- Tipografia segue o sistema existente, com contador em destaque e rótulo do canal em menor peso.

## Implementation Notes

- Extrair o painel para uma pequena função/componente local dentro de `pages/Inventory.tsx` se isso reduzir duplicação.
- Substituir a posição atual `top-[calc(env(safe-area-inset-top,0px)+0.75rem)]` por uma posição baseada em variável CSS/constante da header do app.
- Adicionar uma classe no wrapper da página quando o modo especial estiver ativo para criar padding superior responsivo no conteúdo.
- Manter o comportamento atual de compartilhamento e cálculo de parcelas sem alterar regras de negócio.

## Verification

- Testar o fluxo existente de lista especial no `Inventory.test.tsx`.
- Adicionar ou ajustar teste para garantir que o painel flutuante é renderizado com o label acessível e que o botão de parcelas respeita seleção vazia/selecionada.
- Rodar teste focado da tela de Estoque e typecheck se o ambiente permitir.
