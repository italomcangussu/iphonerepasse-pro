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
    const tooltipBg = isDark ? 'rgba(28,37,46,0.92)' : 'rgba(255,255,255,0.92)';
    const tooltipText = isDark ? '#eceff2' : '#1c252e';

    return {
      isDark,
      gridColor: isDark ? 'rgba(145,158,171,0.16)' : 'rgba(145,158,171,0.2)',
      axisColor: isDark ? '#919eab' : '#919eab',
      seriesPrimary: isDark ? '#73bafb' : '#2152d9',
      tooltipBg,
      tooltipText,
      tooltipContentStyle: {
        backgroundColor: tooltipBg,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: `1px solid ${isDark ? 'rgba(145,158,171,0.24)' : 'rgba(145,158,171,0.2)'}`,
        borderRadius: '8px',
        color: tooltipText,
        fontSize: '13px',
        boxShadow: '0 0 2px rgba(145,158,171,0.24), 0 12px 24px -4px rgba(145,158,171,0.24)',
      },
    };
  }, [resolvedTheme]);
}
