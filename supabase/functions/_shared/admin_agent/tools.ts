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
  listDeviceCatalog,
  listFinanceCategories,
  listOverdueDebts,
  listPayableDebts,
  listRecentTransactions,
  OpsDeps,
  preparePayPayableDebt,
  prepareCreateCreditor,
  prepareCreateCustomer,
  prepareCreateSale,
  prepareCreateStockItem,
  prepareDeleteStockItem,
  prepareDeleteTransaction,
  prepareReceiveDebtPayment,
  prepareRegisterTransaction,
  prepareReleaseReservation,
  prepareReserveStock,
  prepareTransfer,
  prepareUpdateCustomer,
  prepareUpdateStockItem,
  prepareUpdateTransaction,
  prepareUpsertDeviceCatalog,
  prepareUpsertFinanceCategory,
  searchSellers,
  searchStock,
} from "./operations.ts";
import { generateReport } from "./reports.ts";

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
  // --- Novos: leituras auxiliares ------------------------------------------
  {
    type: "function",
    function: {
      name: "search_sellers",
      description: "Busca vendedores por nome. Use para obter o sellerId antes de registrar uma venda.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nome do vendedor." } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_finance_categories",
      description: "Lista as categorias financeiras (receita/despesa) cadastradas.",
      parameters: {
        type: "object",
        properties: { type: { type: "string", enum: ["IN", "OUT"] } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_device_catalog",
      description: "Lista modelos/cores do catálogo de aparelhos.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Filtra por modelo (opcional)." } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description:
        "Gera um relatório em PDF e ENVIA como documento no WhatsApp. É read-only, não precisa de confirmação. Tipos: financeiro, vendas, estoque, dividas.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["financeiro", "vendas", "estoque", "dividas"] },
          period: {
            type: "string",
            description: "Para financeiro/vendas: hoje, ontem, 7d, 30d, mes_atual (padrão) ou mes_passado.",
          },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
  },
  // --- Novos: cadastros e edições (todos prepare_* -> SIM) ------------------
  {
    type: "function",
    function: {
      name: "prepare_create_stock_item",
      description:
        "Prepara o CADASTRO de um aparelho no estoque. NÃO executa — retorna resumo para confirmação. Obrigatórios: model, imei, purchasePrice, sellPrice.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["iPhone", "iPad", "Macbook", "Apple Watch", "Acessório"], description: "Padrão iPhone." },
          model: { type: "string" },
          imei: { type: "string", description: "IMEI ou número de série." },
          color: { type: "string" },
          capacity: { type: "string", description: "Ex.: '128 GB'." },
          condition: { type: "string", enum: ["Novo", "Seminovo"], description: "Padrão Seminovo." },
          batteryHealth: { type: "number", description: "Saúde da bateria 0-100." },
          hasBox: { type: "boolean" },
          purchasePrice: { type: "number" },
          sellPrice: { type: "number" },
          maxDiscount: { type: "number" },
          warrantyType: { type: "string", enum: ["Apple", "Loja"] },
          storeId: { type: "string", description: "Opcional; padrão é a loja principal." },
          notes: { type: "string" },
        },
        required: ["model", "imei", "purchasePrice", "sellPrice"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_update_stock_item",
      description:
        "Prepara a EDIÇÃO de um aparelho do estoque. NÃO executa. Informe stockItemId (de search_stock) ou query e só os campos a mudar.",
      parameters: {
        type: "object",
        properties: {
          stockItemId: { type: "string" },
          query: { type: "string", description: "Alternativa ao stockItemId (modelo/IMEI)." },
          model: { type: "string" },
          imei: { type: "string" },
          color: { type: "string" },
          capacity: { type: "string" },
          condition: { type: "string", enum: ["Novo", "Seminovo"] },
          status: { type: "string", enum: ["Disponível", "Em Preparação", "Reservado", "Em Uso"] },
          batteryHealth: { type: "number" },
          purchasePrice: { type: "number" },
          sellPrice: { type: "number" },
          maxDiscount: { type: "number" },
          notes: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_delete_stock_item",
      description:
        "Prepara a EXCLUSÃO de um aparelho do estoque (só se não vendido e sem reserva/venda). NÃO executa. Informe stockItemId ou query.",
      parameters: {
        type: "object",
        properties: {
          stockItemId: { type: "string" },
          query: { type: "string", description: "Alternativa: modelo/IMEI." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_create_customer",
      description:
        "Prepara o CADASTRO de um cliente (deduplica por CPF/telefone). NÃO executa. Obrigatórios: name, phone.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          cpf: { type: "string" },
          alternativePhone: { type: "string" },
          email: { type: "string" },
          birthDate: { type: "string", description: "AAAA-MM-DD." },
        },
        required: ["name", "phone"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_update_customer",
      description:
        "Prepara a EDIÇÃO de um cliente. NÃO executa. Informe customerId ou query e só os campos a mudar.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          query: { type: "string", description: "Alternativa: nome/telefone." },
          name: { type: "string" },
          phone: { type: "string" },
          cpf: { type: "string" },
          alternativePhone: { type: "string" },
          email: { type: "string" },
          birthDate: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_create_creditor",
      description:
        "Prepara o CADASTRO de um credor (fornecedor). NÃO executa. Obrigatório: name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          document: { type: "string" },
          documentType: { type: "string", enum: ["CPF", "CNPJ"] },
          phone: { type: "string" },
          email: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_update_transaction",
      description:
        "Prepara a EDIÇÃO de um lançamento MANUAL (de list_recent_transactions). NÃO executa. Não edita lançamentos de venda/dívida/transferência.",
      parameters: {
        type: "object",
        properties: {
          transactionId: { type: "string" },
          category: { type: "string" },
          amount: { type: "number" },
          description: { type: "string" },
          account: { type: "string", enum: ["Conta Bancária", "Cofre"] },
          date: { type: "string", description: "AAAA-MM-DD ou ISO." },
        },
        required: ["transactionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_delete_transaction",
      description:
        "Prepara a EXCLUSÃO de um lançamento MANUAL. NÃO executa. Só lançamentos manuais.",
      parameters: {
        type: "object",
        properties: { transactionId: { type: "string" } },
        required: ["transactionId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_create_sale",
      description:
        "Prepara uma VENDA completa. NÃO executa. O cliente precisa existir (use prepare_create_customer antes se necessário). A soma dos pagamentos precisa bater com o total (itens - desconto).",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          customerQuery: { type: "string", description: "Alternativa: nome/telefone do cliente." },
          sellerId: { type: "string" },
          sellerQuery: { type: "string", description: "Alternativa: nome do vendedor." },
          items: {
            type: "array",
            description: "Aparelhos vendidos.",
            items: {
              type: "object",
              properties: {
                stockItemId: { type: "string" },
                query: { type: "string", description: "Alternativa: modelo/IMEI." },
                price: { type: "number", description: "Preço negociado; padrão é o preço de venda do estoque." },
              },
              additionalProperties: false,
            },
          },
          payments: {
            type: "array",
            description: "Formas de pagamento; a soma tem que ser igual ao total.",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Pix", "Dinheiro", "Cartão", "Cartão Débito", "Devedor"] },
                amount: { type: "number" },
                account: { type: "string", enum: ["Conta Bancária", "Cofre"] },
                installments: { type: "number" },
                cardBrand: { type: "string", enum: ["visa_master", "outras"] },
                debtDueDate: { type: "string", description: "Obrigatório se type=Devedor (AAAA-MM-DD)." },
                debtInstallments: { type: "number" },
                debtNotes: { type: "string" },
              },
              additionalProperties: false,
            },
          },
          discount: { type: "number", description: "Desconto em reais sobre o subtotal (opcional)." },
        },
        required: ["items", "payments"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_upsert_finance_category",
      description:
        "Prepara criar/atualizar uma categoria financeira. NÃO executa. type: IN (receita) ou OUT (despesa).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["IN", "OUT"] },
          isDefault: { type: "boolean" },
        },
        required: ["name", "type"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_upsert_device_catalog",
      description:
        "Prepara adicionar um modelo ao catálogo de aparelhos. NÃO executa.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["iPhone", "iPad", "Macbook", "Apple Watch", "Acessório"] },
          model: { type: "string" },
          color: { type: "string" },
        },
        required: ["type", "model"],
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
  "prepare_create_stock_item",
  "prepare_update_stock_item",
  "prepare_delete_stock_item",
  "prepare_create_customer",
  "prepare_update_customer",
  "prepare_create_creditor",
  "prepare_update_transaction",
  "prepare_delete_transaction",
  "prepare_create_sale",
  "prepare_upsert_finance_category",
  "prepare_upsert_device_catalog",
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
    case "search_sellers":
      return await searchSellers(deps, args);
    case "list_finance_categories":
      return await listFinanceCategories(deps, args);
    case "list_device_catalog":
      return await listDeviceCatalog(deps, args);
    case "generate_report":
      return await generateReport(deps, args);
    case "prepare_create_stock_item":
      return await prepareCreateStockItem(deps, args);
    case "prepare_update_stock_item":
      return await prepareUpdateStockItem(deps, args);
    case "prepare_delete_stock_item":
      return await prepareDeleteStockItem(deps, args);
    case "prepare_create_customer":
      return await prepareCreateCustomer(deps, args);
    case "prepare_update_customer":
      return await prepareUpdateCustomer(deps, args);
    case "prepare_create_creditor":
      return await prepareCreateCreditor(deps, args);
    case "prepare_update_transaction":
      return await prepareUpdateTransaction(deps, args);
    case "prepare_delete_transaction":
      return await prepareDeleteTransaction(deps, args);
    case "prepare_create_sale":
      return await prepareCreateSale(deps, args);
    case "prepare_upsert_finance_category":
      return await prepareUpsertFinanceCategory(deps, args);
    case "prepare_upsert_device_catalog":
      return await prepareUpsertDeviceCatalog(deps, args);
    default:
      return { ok: false, error: `Ferramenta desconhecida: ${name}` };
  }
}
