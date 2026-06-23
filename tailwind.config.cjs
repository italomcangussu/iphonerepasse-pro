/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cores da marca iPhoneRepasse
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: 'var(--ds-color-primary-soft, #60a5fa)',
          500: 'var(--ds-color-primary, #2563eb)', // Azul principal (tokenizado)
          600: 'var(--ds-color-primary-strong, #1d4ed8)',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: 'var(--ds-color-accent, #f97316)', // Laranja da logo (tokenizado)
          600: 'var(--ds-color-accent-strong, #c2410c)',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Cores do sistema Apple-style
        ios: {
          blue: '#007AFF',
          green: '#34C759',
          indigo: '#5856D6',
          orange: '#FF9500',
          pink: '#FF2D55',
          purple: '#AF52DE',
          red: '#FF3B30',
          teal: '#5AC8FA',
          yellow: '#FFCC00',
          gray: '#8E8E93',
        },
        // Degraus de elevação tonal semânticos (MD3). Resolvem para os tokens
        // CSS `--ds-elevation-*`: branco no claro, navy progressivo no escuro.
        // Uso típico: `bg-elevation-3` (dropdown/popover), `bg-elevation-4`
        // (modal/sheet) — a ordem de empilhamento fica explícita.
        elevation: {
          0: 'var(--ds-elevation-0)',
          1: 'var(--ds-elevation-1)',
          2: 'var(--ds-elevation-2)',
          3: 'var(--ds-elevation-3)',
          4: 'var(--ds-elevation-4)',
        },
        // Cores de superfície para dark/light mode
        surface: {
          light: {
            50: '#ffffff',
            100: '#f5f5f7', // Apple gray background
            200: '#e5e5e7',
            300: '#d1d1d6',
            400: '#8e8e93',
            500: '#636366',
            600: '#48484a',
            700: '#3a3a3c',
            800: '#2c2c2e',
            900: '#1c1c1e',
          },
          // Escala navy/slate unificada com os tokens semânticos `--ds-*`
          // (index.css) para eliminar o descasamento de temperatura (modal
          // cinza-neutro sobre shell navy). Luminância monotônica preservada:
          // 50–300 = superfícies/bordas (mais claro = mais elevado, MD3 tonal),
          // 400–500 = texto/ícones apagados, 600–700 = texto.
          dark: {
            50: '#0b1220',  // base / shell (= --ds-elevation-0)
            100: '#20293a', // painel elevado (modal/sheet — acima dos cards)
            200: '#2a3446', // borda / header / superfície sutil
            300: '#354155', // hover / nível acima
            400: '#64748b', // slate-500 — apagado
            500: '#94a3b8', // slate-400 — texto apagado (= --ds-color-text-muted)
            600: '#cbd5e1', // slate-300 — texto secundário
            700: '#e2e8f0', // slate-200 — texto
            800: '#f1f5f9',
            900: '#ffffff',
          },
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'ios-large': ['2.125rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 34px
        'ios-title-1': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 28px
        'ios-title-2': ['1.375rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 22px
        'ios-title-3': ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }], // 20px
        'ios-headline': ['1.0625rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }], // 17px
        'ios-body': ['1.0625rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }], // 17px
        'ios-callout': ['1rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 16px
        'ios-subhead': ['0.9375rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 15px
        'ios-footnote': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 13px
        'ios-caption': ['0.75rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 12px
      },
      spacing: {
        ios: '1rem', // 16px base spacing
        'ios-sm': '0.5rem', // 8px
        'ios-md': '0.75rem', // 12px
        'ios-lg': '1.25rem', // 20px
        'ios-xl': '1.5rem', // 24px
        'ios-2xl': '2rem', // 32px
      },
      borderRadius: {
        ios: '0.625rem', // 10px
        'ios-lg': '0.875rem', // 14px
        'ios-xl': '1.25rem', // 20px
        'ios-2xl': '1.5rem', // 24px
      },
      zIndex: {
        70: '70',
        71: '71',
      },
      boxShadow: {
        ios: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'ios-md': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'ios-lg': '0 8px 32px rgba(0, 0, 0, 0.16)',
        'ios-xl': '0 16px 48px rgba(0, 0, 0, 0.2)',
        // iOS 26 — refined multi-layer shadows for cards & rows
        'ios26-sm': '0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)',
        'ios26-md': '0 4px 8px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'ios26-lg': '0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'ios26-glow': '0 0 0 4px rgba(59,130,246,0.15)',
      },
      animation: {
        'ios-fade': 'iosFade 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
        'ios-slide-up': 'iosSlideUp 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
        'ios-scale': 'iosScale 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
        'ios-sheet': 'iosSheet 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        // Skeleton shimmer (US-004)
        'shimmer': 'shimmer 1.4s linear infinite',
      },
      keyframes: {
        iosFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        iosSlideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        iosScale: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        iosSheet: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.4, 0, 0.2, 1)',
        // iOS 26 named easings (Apple HIG WWDC25)
        'ios-out': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'ios-emphasized': 'cubic-bezier(0.2, 0, 0, 1)',
        'ios-spring': 'cubic-bezier(0.5, 1.6, 0.4, 1)',
      },
    },
  },
  plugins: [],
};
