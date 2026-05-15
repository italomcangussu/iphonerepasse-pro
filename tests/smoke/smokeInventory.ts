export type SmokeRole = 'admin' | 'seller';

export type SelectorKind = 'button' | 'link' | 'testid';
export type AnchorKind = 'heading' | 'text' | 'testid';
export type ActionType = 'navigation' | 'create' | 'update' | 'delete' | 'modal' | 'refresh' | 'filter';

export interface SmokeExpectation {
  kind: 'urlContains' | 'heading' | 'text';
  value: string;
}

export interface SmokeSelectorStep {
  selectorKind: SelectorKind;
  selectorValue: string;
}

export interface SmokeAction {
  id: string;
  label: string;
  type: ActionType;
  selectorKind: SelectorKind;
  selectorValue: string;
  before?: SmokeSelectorStep[];
  expect?: SmokeExpectation;
  migrationHints?: string[];
}

export interface SmokeRoute {
  id: string;
  path: string;
  roles: SmokeRole[];
  menuKey?: string;
  anchorKind: AnchorKind;
  anchorValue: string;
  actions: SmokeAction[];
  migrationHints?: string[];
}

export const menuPathByKey: Record<string, string> = {
  dashboard: '/#/',
  pdv: '/#/pdv',
  calculator: '/#/calculator',
  inventory: '/#/inventory',
  in_use: '/#/in-use',
  clients: '/#/clients',
  warranties: '/#/warranties',
  debtors: '/#/debtors',
  finance: '/#/finance',
  parts_stock: '/#/parts-stock',
  sellers: '/#/sellers',
  stores: '/#/stores',
  settings: '/#/settings'
};

export const roleMenuKeys: Record<SmokeRole, string[]> = {
  seller: ['dashboard', 'pdv', 'calculator', 'inventory', 'in_use', 'clients', 'warranties', 'parts_stock', 'settings'],
  admin: ['dashboard', 'pdv', 'calculator', 'inventory', 'in_use', 'clients', 'warranties', 'debtors', 'finance', 'parts_stock', 'sellers', 'stores', 'settings']
};

export const smokeRoutes: SmokeRoute[] = [
  {
    id: 'dashboard',
    path: '/#/',
    roles: ['admin', 'seller'],
    menuKey: 'dashboard',
    anchorKind: 'heading',
    anchorValue: 'Dashboard',
    actions: [
      {
        id: 'dashboard_new_sale',
        label: 'Nova venda',
        type: 'navigation',
        selectorKind: 'link',
        selectorValue: 'Nova venda',
        expect: { kind: 'urlContains', value: '/#/pdv/nova-venda' },
        migrationHints: ['20260416193928_pdv_step3_discount_and_negotiated_price']
      }
    ],
    migrationHints: ['20260211124957_auth_rbac_rls_phase1']
  },
  {
    id: 'pdv_history',
    path: '/#/pdv',
    roles: ['admin', 'seller'],
    menuKey: 'pdv',
    anchorKind: 'heading',
    anchorValue: 'Historico de Vendas',
    actions: [
      {
        id: 'pdv_history_clear_filters',
        label: 'Limpar filtros',
        type: 'filter',
        selectorKind: 'button',
        selectorValue: 'Limpar filtros',
        expect: { kind: 'heading', value: 'Historico de Vendas' },
        migrationHints: ['20260416230000_sale_cancellation_trigger']
      }
    ],
    migrationHints: ['20260416230000_sale_cancellation_trigger']
  },
  {
    id: 'pdv_new_sale',
    path: '/#/pdv/nova-venda',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Vendedor e Cliente',
    actions: [],
    migrationHints: ['20260416193928_pdv_step3_discount_and_negotiated_price', '20260416231005_sale_items_stock_decrement_trigger']
  },
  {
    id: 'calculator',
    path: '/#/calculator',
    roles: ['admin', 'seller'],
    menuKey: 'calculator',
    anchorKind: 'heading',
    anchorValue: 'Calculadora de Taxas',
    actions: []
  },
  {
    id: 'inventory',
    path: '/#/inventory',
    roles: ['admin', 'seller'],
    menuKey: 'inventory',
    anchorKind: 'heading',
    anchorValue: 'Estoque',
    actions: [
      {
        id: 'inventory_add_item_modal',
        label: 'Adicionar Aparelho',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Adicionar Aparelho',
        expect: { kind: 'heading', value: 'Novo Aparelho' },
        migrationHints: ['20260215213000_add_stock_items_observations']
      }
    ],
    migrationHints: ['20260215213000_add_stock_items_observations']
  },
  {
    id: 'in_use',
    path: '/#/in-use',
    roles: ['admin', 'seller'],
    menuKey: 'in_use',
    anchorKind: 'heading',
    anchorValue: 'Em Uso',
    actions: [],
    migrationHints: ['20260427000000_add_stock_items_in_use_status']
  },
  {
    id: 'clients',
    path: '/#/clients',
    roles: ['admin', 'seller'],
    menuKey: 'clients',
    anchorKind: 'heading',
    anchorValue: 'Clientes',
    actions: [
      {
        id: 'clients_new_modal',
        label: 'Novo Cliente',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo Cliente',
        expect: { kind: 'heading', value: 'Novo Cliente' },
        migrationHints: ['20260211124957_auth_rbac_rls_phase1']
      }
    ],
    migrationHints: ['20260211124957_auth_rbac_rls_phase1']
  },
  {
    id: 'warranties',
    path: '/#/warranties',
    roles: ['admin', 'seller'],
    menuKey: 'warranties',
    anchorKind: 'heading',
    anchorValue: 'Garantias',
    actions: [
      {
        id: 'warranties_add_manual_modal',
        label: 'Adicionar garantia',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Adicionar garantia',
        expect: { kind: 'heading', value: 'Adicionar garantia avulsa' },
        migrationHints: ['20260216123000_add_warranty_public_tokens']
      }
    ],
    migrationHints: ['20260216123000_add_warranty_public_tokens']
  },
  {
    id: 'parts_stock',
    path: '/#/parts-stock',
    roles: ['admin', 'seller'],
    menuKey: 'parts_stock',
    anchorKind: 'heading',
    anchorValue: 'Estoque de Peças',
    actions: [
      {
        id: 'parts_stock_add_modal',
        label: 'Adicionar Peça',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Adicionar Peça',
        expect: { kind: 'heading', value: 'Adicionar Peça' },
        migrationHints: ['20260216090000_add_parts_inventory_and_seed']
      }
    ],
    migrationHints: ['20260216090000_add_parts_inventory_and_seed']
  },
  {
    id: 'settings',
    path: '/#/settings',
    roles: ['admin', 'seller'],
    menuKey: 'settings',
    anchorKind: 'heading',
    anchorValue: 'Configuracoes',
    actions: [
      {
        id: 'settings_open_card_fees',
        label: 'Editar Taxas',
        type: 'navigation',
        selectorKind: 'button',
        selectorValue: 'Editar Taxas',
        expect: { kind: 'urlContains', value: '/#/settings/card-fees' },
        migrationHints: ['20260217103000_add_card_fee_settings_and_payment_fields']
      }
    ],
    migrationHints: ['20260416154712_settings_permissions_and_user_activity']
  },
  {
    id: 'card_fees_settings',
    path: '/#/settings/card-fees',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Editar Taxas',
    actions: [
      {
        id: 'card_fees_switch_tab',
        label: 'Outras',
        type: 'filter',
        selectorKind: 'button',
        selectorValue: 'Outras',
        expect: { kind: 'heading', value: 'Editar Taxas' },
        migrationHints: ['20260217103000_add_card_fee_settings_and_payment_fields']
      }
    ],
    migrationHints: ['20260217103000_add_card_fee_settings_and_payment_fields']
  },
  {
    id: 'finance',
    path: '/#/finance',
    roles: ['admin'],
    menuKey: 'finance',
    anchorKind: 'heading',
    anchorValue: 'Financeiro',
    actions: [
      {
        id: 'finance_open_bank_tab',
        label: 'Conta Bancária',
        type: 'navigation',
        selectorKind: 'testid',
        selectorValue: 'finance-tab-bank',
        expect: { kind: 'text', value: 'Saldo Disponível' },
        migrationHints: ['20260416160934_finance_accounts_debts_installments_and_storage']
      },
      {
        id: 'finance_open_new_aporte',
        label: 'Aporte',
        type: 'create',
        selectorKind: 'testid',
        selectorValue: 'finance-action-aporte',
        before: [{ selectorKind: 'testid', selectorValue: 'finance-tab-bank' }],
        expect: { kind: 'heading', value: 'Novo Aporte' },
        migrationHints: ['20260416160934_finance_accounts_debts_installments_and_storage']
      }
    ],
    migrationHints: ['20260416160934_finance_accounts_debts_installments_and_storage']
  },
  {
    id: 'debtors',
    path: '/#/debtors',
    roles: ['admin'],
    menuKey: 'debtors',
    anchorKind: 'heading',
    anchorValue: 'Devedores',
    actions: [
      {
        id: 'debtors_new_modal',
        label: 'Novo Devedor',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo Devedor',
        expect: { kind: 'heading', value: 'Novo Devedor' },
        migrationHints: ['20260416220000_debt_payment_reversal_flow']
      }
    ],
    migrationHints: ['20260416220000_debt_payment_reversal_flow']
  },
  {
    id: 'sellers',
    path: '/#/sellers',
    roles: ['admin'],
    menuKey: 'sellers',
    anchorKind: 'heading',
    anchorValue: 'Vendedores',
    actions: [
      {
        id: 'sellers_new_modal',
        label: 'Novo Vendedor',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo Vendedor',
        expect: { kind: 'heading', value: 'Novo Vendedor' },
        migrationHints: ['20260215232000_sellers_store_and_optional_auth']
      }
    ],
    migrationHints: ['20260215232000_sellers_store_and_optional_auth']
  },
  {
    id: 'stores',
    path: '/#/stores',
    roles: ['admin'],
    menuKey: 'stores',
    anchorKind: 'heading',
    anchorValue: 'Lojas',
    actions: [
      {
        id: 'stores_new_modal',
        label: 'Nova Loja',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Nova Loja',
        expect: { kind: 'heading', value: 'Nova Loja' },
        migrationHints: ['20260211124957_auth_rbac_rls_phase1']
      }
    ],
    migrationHints: ['20260211124957_auth_rbac_rls_phase1']
  },
  {
    id: 'profile_store',
    path: '/#/profile',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Perfil da Loja',
    actions: [],
    migrationHints: ['20260211124957_auth_rbac_rls_phase1']
  },
  {
    id: 'crm_conversations',
    path: '/#/crm/conversations',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Conversas',
    actions: [
      {
        id: 'crm_conversations_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Conversas' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_comments',
    path: '/#/crm/comments',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Comentários',
    actions: [
      {
        id: 'crm_comments_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Comentários' },
        migrationHints: ['20260416141126_crm_plus_full_parity_modules_and_handoff']
      }
    ],
    migrationHints: ['20260416141126_crm_plus_full_parity_modules_and_handoff']
  },
  {
    id: 'crm_leads',
    path: '/#/crm/leads',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'CRM Leads',
    actions: [
      {
        id: 'crm_leads_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'CRM Leads' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_funnels',
    path: '/#/crm/funnels',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Funis',
    actions: [
      {
        id: 'crm_funnels_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Funis' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_statistics',
    path: '/#/crm/statistics',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Estatísticas',
    actions: [
      {
        id: 'crm_statistics_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Estatísticas' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_ads',
    path: '/#/crm/ads',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Ads',
    actions: [
      {
        id: 'crm_ads_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Ads' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_forms',
    path: '/#/crm/forms',
    roles: ['admin', 'seller'],
    anchorKind: 'heading',
    anchorValue: 'Formulários',
    actions: [
      {
        id: 'crm_forms_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Formulários' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_channels',
    path: '/#/crm/channels',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'CRM Canais',
    actions: [
      {
        id: 'crm_channels_new_modal',
        label: 'Novo Canal',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo Canal',
        expect: { kind: 'heading', value: 'Novo Canal CRM' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only', '20260416212431_add_crm_conversations_channel_fk']
  },
  {
    id: 'crm_settings',
    path: '/#/crm/settings',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'CRM Canais',
    actions: [
      {
        id: 'crm_settings_refresh_channels',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'CRM Canais' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_automations',
    path: '/#/crm/automations',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Automações',
    actions: [
      {
        id: 'crm_automations_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Automações' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_broadcasts',
    path: '/#/crm/broadcasts',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Broadcasts',
    actions: [
      {
        id: 'crm_broadcasts_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Broadcasts' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_templates',
    path: '/#/crm/templates',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Templates',
    actions: [
      {
        id: 'crm_templates_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Templates' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_custom_fields',
    path: '/#/crm/custom-fields',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Campos Personalizados',
    actions: [
      {
        id: 'crm_custom_fields_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Campos Personalizados' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_attendance_scripts',
    path: '/#/crm/attendance-scripts',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Scripts de Atendimento',
    actions: [
      {
        id: 'crm_attendance_scripts_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Scripts de Atendimento' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_integrations',
    path: '/#/crm/integrations',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Integrações',
    actions: [
      {
        id: 'crm_integrations_new',
        label: 'Novo',
        type: 'create',
        selectorKind: 'button',
        selectorValue: 'Novo',
        expect: { kind: 'heading', value: 'Integrações' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  },
  {
    id: 'crm_cashback',
    path: '/#/crm/cashback',
    roles: ['admin'],
    anchorKind: 'heading',
    anchorValue: 'Cashback',
    actions: [
      {
        id: 'crm_cashback_refresh',
        label: 'Atualizar',
        type: 'refresh',
        selectorKind: 'button',
        selectorValue: 'Atualizar',
        expect: { kind: 'heading', value: 'Cashback' },
        migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
      }
    ],
    migrationHints: ['20260415183000_crm_plus_uazapi_instagram_only']
  }
];
