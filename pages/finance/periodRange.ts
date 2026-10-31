export type DatePreset = 'all' | 'today' | 'yesterday' | 'current_month' | 'last_month' | 'year' | 'custom';

export const getEffectiveDateRange = (
  preset: DatePreset,
  customFrom: string,
  customTo: string
): { from: Date | null; to: Date | null } => {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  switch (preset) {
    case 'today':
      return { from: startOfToday, to: endOfToday };
    case 'yesterday': {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return {
        from: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0),
        to: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999),
      };
    }
    case 'current_month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfToday };
    case 'last_month': {
      const fm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lm = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from: fm, to: lm };
    }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfToday };
    case 'custom':
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
        to: customTo ? new Date(`${customTo}T23:59:59`) : null,
      };
    default:
      return { from: null, to: null };
  }
};

export const isInDateRange = (dateStr: string, from: Date | null, to: Date | null): boolean => {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};
