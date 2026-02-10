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
          400: '#60a5fa',
          500: '#3b82f6', // Azul principal
          600: '#2563eb',
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
          500: '#f97316', // Laranja da logo
          600: '#ea580c',
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
          dark: {
            50: '#1c1c1e',
            100: '#2c2c2e',
            200: '#3a3a3c',
            300: '#48484a',
            400: '#636366',
            500: '#8e8e93',
            600: '#d1d1d6',
            700: '#e5e5e7',
            800: '#f5f5f7',
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
      boxShadow: {
        ios: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'ios-md': '0 4px 16px rgba(0, 0, 0, 0.12)',
        'ios-lg': '0 8px 32px rgba(0, 0, 0, 0.16)',
        'ios-xl': '0 16px 48px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'ios-fade': 'iosFade 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'ios-slide-up': 'iosSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'ios-scale': 'iosScale 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        iosFade: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        iosSlideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        iosScale: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};

