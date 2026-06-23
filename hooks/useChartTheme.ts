import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Paleta de gráficos (recharts) ciente do tema. Centraliza as cores de grid,
 * eixos, tooltip e série para que os gráficos respeitem o dark mode — em vez de
 * hex cravados que deixavam o tooltip branco e o grid claro sobre fundo escuro.
 *
 * Origem: o padrão já existia inline no Dashboard; foi extraído aqui para ser
 * reutilizado (Dashboard, Finance, …) sem duplicação.
 */
export interface ChartTheme {
  isDark: boolean;
  /** Linhas do CartesianGrid. */
  gridColor: string;
  /** Eixos (XAxis/YAxis stroke) e ticks. */
  axisColor: string;
  /** Cor de série primária (ex.: barras), clareada no escuro. */
  seriesPrimary: string;
  tooltipBg: string;
  tooltipText: string;
  /** Pronto para `<Tooltip contentStyle={...} />` do recharts. */
  tooltipContentStyle: CSSProperties;
}

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();

  return useMemo<ChartTheme>(() => {
    const isDark = resolvedTheme === 'dark';
    const tooltipBg = isDark ? 'rgba(17,24,39,0.92)' : 'rgba(255,255,255,0.92)';
    const tooltipText = isDark ? '#f8fafc' : '#111827';

    return {
      isDark,
      gridColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.07)',
      axisColor: isDark ? '#64748b' : '#94a3b8',
      seriesPrimary: isDark ? '#60a5fa' : '#3b82f6',
      tooltipBg,
      tooltipText,
      tooltipContentStyle: {
        backgroundColor: tooltipBg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: '14px',
        color: tooltipText,
        fontSize: '13px',
        boxShadow: '0 12px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
      },
    };
  }, [resolvedTheme]);
}
