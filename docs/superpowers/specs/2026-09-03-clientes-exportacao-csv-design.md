# Exportação CSV de clientes

## Objetivo

Permitir que a tela **Clientes** baixe a base completa de clientes em CSV para uso externo.

## Experiência

Um botão secundário `Exportar CSV`, com ícone de download, ficará ao lado de `Novo Cliente` no cabeçalho da tela. O download exporta todos os clientes cadastrados, independente do texto na busca.

## Dados exportados

O arquivo contém uma linha por cliente e o cabeçalho, nesta ordem:

1. `nome`
2. `telefone`
3. `cpf`
4. `data de nascimento`
5. `modelo de aparelho comprado`
6. `cidade`

Para cada cliente, as vendas vinculadas pelo `customerId` são consolidadas. Os modelos dos itens vendidos são únicos e separados por ` | `. As cidades são resolvidas pelo `storeId` da venda (com o `storeId` do primeiro item como compatibilidade) e exibidas uma única vez, também separadas por ` | `. Clientes sem vendas mantêm essas duas colunas vazias.

## Formato e robustez

O CSV usa UTF-8 com BOM, separador `,` e escape RFC 4180: campos com vírgula, aspas ou quebra de linha são envolvidos por aspas, e aspas internas são duplicadas. O nome do arquivo contém a data: `clientes_YYYY-MM-DD.csv`.

## Organização e testes

A transformação para CSV será uma função pura, exportada da tela ou de um módulo adjacente, para permitir teste sem depender do navegador. O teste cobre consolidação de compras e cidades, deduplicação, campos vazios e escape de CSV. Um teste da tela confirma que o botão dispara o download com o conteúdo esperado.
