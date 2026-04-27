import type { AppRole } from '../types';

export type PermissionAction = 'visible' | 'editable' | 'deletable';

export type PermissionKey =
  | 'dashboard'
  | 'pdv'
  | 'inventory'
  | 'in_use'
  | 'clients'
  | 'warranties'
  | 'debtors'
  | 'finance'
  | 'parts_stock'
  | 'sellers'
  | 'stores'
  | 'settings'
  | 'profile_store'
  | 'card_fees'
  | 'settings_accounts'
  | 'user_logs'
  | 'permissions_privacy';

export type PermissionState = {
  visible: boolean;
  editable: boolean;
  deletable: boolean;
};

export type PermissionMatrix = Record<AppRole, Record<PermissionKey, PermissionState>>;

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  routePrefixes: string[];
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Gerente',
  seller: 'Vendedor',
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', routePrefixes: ['/'] },
  { key: 'pdv', label: 'PDV e Historico de vendas', routePrefixes: ['/pdv'] },
  { key: 'inventory', label: 'Estoque de aparelhos', routePrefixes: ['/inventory'] },
  { key: 'in_use', label: 'Em Uso', routePrefixes: ['/in-use'] },
  { key: 'clients', label: 'Clientes', routePrefixes: ['/clients'] },
  { key: 'warranties', label: 'Garantias', routePrefixes: ['/warranties'] },
  { key: 'debtors', label: 'Devedores', routePrefixes: ['/debtors'] },
  { key: 'finance', label: 'Financeiro', routePrefixes: ['/finance'] },
  { key: 'parts_stock', label: 'Estoque de pecas', routePrefixes: ['/parts-stock'] },
  { key: 'sellers', label: 'Vendedores', routePrefixes: ['/sellers'] },
  { key: 'stores', label: 'Lojas', routePrefixes: ['/stores'] },
  { key: 'settings', label: 'Configuracoes (menu)', routePrefixes: ['/settings'] },
  { key: 'profile_store', label: 'Perfil da loja', routePrefixes: ['/profile'] },
  { key: 'card_fees', label: 'Taxas de cartao', routePrefixes: ['/settings/card-fees'] },
  { key: 'settings_accounts', label: 'Senhas e Contas', routePrefixes: [] },
  { key: 'user_logs', label: 'Log de usuarios', routePrefixes: [] },
  { key: 'permissions_privacy', label: 'Permissoes e Privacidade', routePrefixes: [] },
];

const permissionKeyList = PERMISSION_DEFINITIONS.map((item) => item.key);

const makeDefaults = (role: AppRole): Record<PermissionKey, PermissionState> => {
  const defaults = {} as Record<PermissionKey, PermissionState>;

  for (const key of permissionKeyList) {
    defaults[key] = { visible: false, editable: false, deletable: false };
  }

  if (role === 'admin') {
    for (const key of permissionKeyList) {
      defaults[key] = { visible: true, editable: true, deletable: true };
    }
    return defaults;
  }

  const commonVisible: PermissionKey[] = [
    'dashboard',
    'pdv',
    'inventory',
    'in_use',
    'clients',
    'warranties',
    'parts_stock',
    'settings',
    'card_fees',
  ];
  for (const key of commonVisible) {
    defaults[key] = { visible: true, editable: true, deletable: false };
  }

  return defaults;
};

export const buildDefaultPermissionMatrix = (): PermissionMatrix => ({
  admin: makeDefaults('admin'),
  manager: makeDefaults('manager'),
  seller: makeDefaults('seller'),
});

export const resolvePermissionKeyFromPath = (pathname: string): PermissionKey | null => {
  // Match longer prefixes first (e.g. /settings/card-fees before /settings).
  const sortable = [...PERMISSION_DEFINITIONS]
    .filter((item) => item.routePrefixes.length > 0)
    .flatMap((item) => item.routePrefixes.map((prefix) => ({ key: item.key, prefix })))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  for (const item of sortable) {
    if (item.prefix === '/') {
      if (pathname === '/') return item.key;
      continue;
    }
    if (pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)) {
      return item.key;
    }
  }

  return null;
};
