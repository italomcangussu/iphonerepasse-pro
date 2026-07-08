// Tool registry exposed to the LLM (OpenAI-compatible function schema, used by
// OpenRouter). Confirmation of writes is handled deterministically in the
// runner, so no `confirm`/`cancel` tool is exposed here — the `prepare_*` tools
// only stage a pending action and never mutate.

import {
  findDebtBalance,
  getAccountBalances,
  getCustomerProfile,
  getFinancialSummary,
  getInventorySummary,
  getReservations,
  getSalesSummary,
  listOverdueDebts,
  listPayableDebts,
  listRecentTransactions,
  OpsDeps,
  preparePayPayableDebt,
  prepareReceiveDebtPayment,
  prepareRegisterTransaction,
  prepareReleaseReservation,
  prepareReserveStock,
  prepareTransfer,
  searchStock,
} from "./operations.ts";

export interface ToolSpec {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const TOOL_SPECS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "get_account_balances",
      description:
        "Retorna os saldos atuais das contas (Conta Bancária, Cofre) e o total em Devedores.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "find_debt_balance",
      description:
        "Consulta o saldo de dívidas em aberto de um cliente pelo nome ou telefone.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome ou telefone do cliente." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_stock",
      description:
        "Busca aparelhos no estoque por modelo ou IMEI. Use antes de reservar para obter o stockItemId.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Modelo (ex.: 'iPhone 13') ou IMEI." },
          onlyAvailable: {
            type: "boolean",
            description: "Se true (padrão), só aparelhos Disponíveis.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reservations",
      description: "Lista reservas ativas, opcionalmente filtradas por cliente.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome ou telefone do cliente (opcional)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_financial_summary",
      description:
        "Resumo financeiro do período: total de receitas, despesas, saldo do período e maiores categorias de despesa. Use para 'como está o financeiro/caixa hoje/no mês'.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "Período: hoje, ontem, 7d, 30d, mes_atual (padrão) ou mes_passado.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_sales_summary",
      description:
        "Resumo de vendas do período: quantidade, faturamento e ticket médio.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "Período: hoje, ontem, 7d, 30d, mes_atual (padrão) ou mes_passado.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventory_summary",
      description:
        "Resumo do estoque: quantidade disponível/reservada/em preparação e o capital investido (valor de compra e de venda em estoque).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_overdue_debts",
      description:
        "Lista as dívidas de clientes (a receber) vencidas, da mais antiga para a mais nova.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de itens (padrão 10)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_payable_debts",
      description:
        "Lista as contas a pagar (dívidas ativas com credores) em aberto. Use onlyOverdue para só as vencidas.",
      parameters: {
        type: "object",
        properties: {
          onlyOverdue: { type: "boolean", description: "Se true, só as vencidas." },
          limit: { type: "number", description: "Máximo de itens (padrão 15)." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_transactions",
      description:
        "Lista os últimos lançamentos financeiros, opcionalmente filtrando por conta e/ou tipo (IN/OUT).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de itens (padrão 10)." },
          account: { type: "string", enum: ["Conta Bancária", "Cofre"] },
          type: { type: "string", enum: ["IN", "OUT"] },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_customer_profile",
      description:
        "Perfil resumido de um cliente pelo nome ou telefone: compras, total gasto e dívida em aberto.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Nome ou telefone do cliente." },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_transfer",
      description:
        "Prepara uma transferência entre Conta Bancária e Cofre. NÃO executa: retorna um resumo que precisa ser confirmado pelo admin. Só chame quando o admin pediu explicitamente uma transferência com valor e contas claros.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Valor em reais." },
          from: { type: "string", enum: ["Conta Bancária", "Cofre"] },
          to: { type: "string", enum: ["Conta Bancária", "Cofre"] },
        },
        required: ["amount", "from", "to"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_reserve_stock",
      description:
        "Prepara a reserva de um aparelho para um cliente. NÃO executa: retorna um resumo que precisa ser confirmado. Obtenha o stockItemId com search_stock antes.",
      parameters: {
        type: "object",
        properties: {
          stockItemId: { type: "string", description: "ID do aparelho (de search_stock)." },
          query: { type: "string", description: "Alternativa: modelo/IMEI se não tiver o stockItemId." },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          expiresAt: { type: "string", description: "ISO date/datetime de expiração (opcional)." },
          depositAmount: { type: "number", description: "Valor do sinal (opcional)." },
          depositPaymentMethod: {
            type: "string",
            description: "Forma do sinal: Pix, Dinheiro, Cartão (obrigatório se houver sinal).",
          },
          notes: { type: "string" },
        },
        required: ["customerName", "customerPhone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_register_transaction",
      description:
        "Prepara um lançamento financeiro manual: receita (IN) ou despesa (OUT) em Conta Bancária ou Cofre. NÃO executa — retorna um resumo para confirmação. Não use para transferências (use prepare_transfer) nem para pagamentos de dívidas (use as ferramentas específicas).",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["IN", "OUT"], description: "IN = receita, OUT = despesa." },
          amount: { type: "number", description: "Valor em reais." },
          account: { type: "string", enum: ["Conta Bancária", "Cofre"] },
          category: { type: "string", description: "Categoria (ex.: Aporte, Retirada, Insumo, Serviço)." },
          description: { type: "string", description: "Descrição do lançamento." },
        },
        required: ["type", "amount", "account"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_receive_debt_payment",
      description:
        "Prepara o RECEBIMENTO de um pagamento de dívida de cliente (a receber). NÃO executa — retorna resumo para confirmação. Informe o debtId (de find_debt_balance) ou a busca do cliente por query.",
      parameters: {
        type: "object",
        properties: {
          debtId: { type: "string", description: "ID da dívida (de find_debt_balance)." },
          query: { type: "string", description: "Alternativa: nome/telefone do cliente se não tiver o debtId." },
          amount: { type: "number", description: "Valor recebido." },
          paymentMethod: { type: "string", enum: ["Pix", "Dinheiro", "Cartão"] },
          account: { type: "string", enum: ["Conta Bancária", "Cofre"], description: "Conta que recebe (padrão Conta Bancária)." },
          notes: { type: "string" },
        },
        required: ["amount", "paymentMethod"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_pay_payable_debt",
      description:
        "Prepara o PAGAMENTO de uma conta a pagar (dívida ativa com credor). NÃO executa — retorna resumo para confirmação. Informe o payableDebtId ou o credor por query.",
      parameters: {
        type: "object",
        properties: {
          payableDebtId: { type: "string", description: "ID da conta a pagar (de list_payable_debts)." },
          query: { type: "string", description: "Alternativa: nome do credor." },
          amount: { type: "number", description: "Valor pago." },
          paymentMethod: { type: "string", enum: ["Pix", "Dinheiro", "Cartão"] },
          account: { type: "string", enum: ["Conta Bancária", "Cofre"], description: "Conta que paga (padrão Conta Bancária)." },
          notes: { type: "string" },
        },
        required: ["amount", "paymentMethod"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_release_reservation",
      description:
        "Prepara a LIBERAÇÃO (cancelamento) de uma reserva de aparelho, opcionalmente estornando o sinal. NÃO executa — retorna resumo para confirmação. Informe o stockItemId ou busque a reserva por query (cliente).",
      parameters: {
        type: "object",
        properties: {
          stockItemId: { type: "string", description: "ID do aparelho reservado." },
          query: { type: "string", description: "Alternativa: nome/telefone do cliente da reserva." },
          refundDeposit: { type: "boolean", description: "Se true, estorna o sinal pago." },
        },
        additionalProperties: false,
      },
    },
  },
];

/** Names whose successful result should short-circuit the LLM loop and ask for confirmation. */
export const PREPARE_TOOLS = new Set([
  "prepare_transfer",
  "prepare_reserve_stock",
  "prepare_register_transaction",
  "prepare_receive_debt_payment",
  "prepare_pay_payable_debt",
  "prepare_release_reservation",
]);

/** Execute a tool call and return a JSON-serializable result. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  deps: OpsDeps,
): Promise<unknown> {
  switch (name) {
    case "get_account_balances":
      return await getAccountBalances(deps);
    case "find_debt_balance":
      return await findDebtBalance(deps, args);
    case "search_stock":
      return await searchStock(deps, args);
    case "get_reservations":
      return await getReservations(deps, args);
    case "get_financial_summary":
      return await getFinancialSummary(deps, args);
    case "get_sales_summary":
      return await getSalesSummary(deps, args);
    case "get_inventory_summary":
      return await getInventorySummary(deps);
    case "list_overdue_debts":
      return await listOverdueDebts(deps, args);
    case "list_payable_debts":
      return await listPayableDebts(deps, args);
    case "list_recent_transactions":
      return await listRecentTransactions(deps, args);
    case "get_customer_profile":
      return await getCustomerProfile(deps, args);
    case "prepare_transfer":
      return await prepareTransfer(deps, args);
    case "prepare_reserve_stock":
      return await prepareReserveStock(deps, args);
    case "prepare_register_transaction":
      return await prepareRegisterTransaction(deps, args);
    case "prepare_receive_debt_payment":
      return await prepareReceiveDebtPayment(deps, args);
    case "prepare_pay_payable_debt":
      return await preparePayPayableDebt(deps, args);
    case "prepare_release_reservation":
      return await prepareReleaseReservation(deps, args);
    default:
      return { ok: false, error: `Ferramenta desconhecida: ${name}` };
  }
}
