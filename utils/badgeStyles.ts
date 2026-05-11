/** Shared Tailwind class maps for iOS-style status/deadline badges. */

export const DEBT_STATUS_BADGE: Record<'Aberta' | 'Parcial' | 'Quitada', string> = {
  Aberta: 'ios-badge-orange',
  Parcial: 'ios-badge-blue',
  Quitada: 'ios-badge-green',
};

export const DEADLINE_BADGE: Record<'Em aberto' | 'Atrasado' | 'Em dias' | 'Pago', string> = {
  'Em aberto': 'ios-badge-blue',
  Atrasado: 'ios-badge-red',
  'Em dias': 'ios-badge-green',
  Pago: 'ios-badge-green',
};
