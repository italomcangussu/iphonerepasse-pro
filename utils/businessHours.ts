import type { BusinessHours, SpecialBusinessHours } from '../types';

export const BUSINESS_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const BUSINESS_DAY_LABELS: Record<keyof BusinessHours, string> = {
  mon: 'Segunda',
  tue: 'Terça',
  wed: 'Quarta',
  thu: 'Quinta',
  fri: 'Sexta',
  sat: 'Sábado',
  sun: 'Domingo',
};

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  mon: { open: '09:00', close: '22:00' },
  tue: { open: '09:00', close: '22:00' },
  wed: { open: '09:00', close: '22:00' },
  thu: { open: '09:00', close: '22:00' },
  fri: { open: '09:00', close: '22:00' },
  sat: { open: '09:00', close: '22:00' },
  sun: { open: '14:00', close: '20:00' },
};

export const DEFAULT_SPECIAL_BUSINESS_HOURS: SpecialBusinessHours = {
  '2026-04-03': {
    closed: true,
    label: 'Páscoa',
  },
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const timeOrFallback = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value : fallback;

export const normalizeBusinessHours = (value: unknown): BusinessHours => {
  const source = isPlainRecord(value) ? value : {};
  return BUSINESS_DAY_KEYS.reduce((hours, day) => {
    const fallback = DEFAULT_BUSINESS_HOURS[day];
    const entry = isPlainRecord(source[day]) ? source[day] : {};
    hours[day] = {
      open: timeOrFallback(entry.open, fallback.open),
      close: timeOrFallback(entry.close, fallback.close),
    };
    return hours;
  }, {} as BusinessHours);
};

export const normalizeSpecialBusinessHours = (value: unknown): SpecialBusinessHours => {
  if (!isPlainRecord(value)) return { ...DEFAULT_SPECIAL_BUSINESS_HOURS };

  return Object.entries(value).reduce<SpecialBusinessHours>((specialHours, [date, rawEntry]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isPlainRecord(rawEntry)) return specialHours;

    const closed = rawEntry.closed === true;
    const label = typeof rawEntry.label === 'string' ? rawEntry.label : '';
    specialHours[date] = closed
      ? { closed: true, label }
      : {
          closed: false,
          label,
          open: timeOrFallback(rawEntry.open, '09:00'),
          close: timeOrFallback(rawEntry.close, '22:00'),
        };

    return specialHours;
  }, {});
};
