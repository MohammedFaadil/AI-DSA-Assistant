import type { Config } from 'tailwindcss';

/**
 * Design tokens.
 *
 * A single dark-first palette with one accent. The restraint is deliberate:
 * the editor and the problem text carry the colour in this product, so the
 * chrome around them stays quiet.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090c',
          900: '#0b0d12',
          850: '#0f1116',
          800: '#14171e',
          750: '#191d26',
          700: '#1f242f',
          600: '#2b313e',
          500: '#3d4553',
          400: '#5a6273',
          300: '#8b93a5',
          200: '#b9c0cd',
          100: '#e3e7ee',
        },
        accent: {
          DEFAULT: '#6366f1',
          soft: '#818cf8',
          deep: '#4338ca',
          glow: 'rgba(99, 102, 241, 0.18)',
        },
        easy: '#22c55e',
        medium: '#f59e0b',
        hard: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 12px 40px -12px rgba(0,0,0,0.6)',
        glow: '0 0 0 1px rgba(99,102,241,0.3), 0 8px 32px -8px rgba(99,102,241,0.4)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
