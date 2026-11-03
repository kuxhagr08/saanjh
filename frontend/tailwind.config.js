/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"], [data-theme="amoled"], .dark'],
  theme: {
    extend: {
      colors: {
        apna: {
          bg: 'var(--apna-bg)',
          surface: 'var(--apna-surface)',
          'surface-2': 'var(--apna-surface-2)',
          border: 'var(--apna-border)',
          text: 'var(--apna-text)',
          muted: 'var(--apna-muted)',
          faint: 'var(--apna-faint)',
          accent: 'var(--apna-accent)',
          'accent-soft': 'var(--apna-accent-soft)',
          'accent-ink': 'var(--apna-accent-ink)',
          success: 'var(--apna-success)',
          warn: 'var(--apna-warn)',
          danger: 'var(--apna-danger)',
          glass: 'var(--apna-glass)',
          'glass-border': 'var(--apna-glass-border)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Courier New', 'monospace'],
      },
      borderRadius: {
        card: '16px',
        input: '12px',
        btn: '12px',
        chip: '999px',
        sheet: '24px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(20, 16, 10, 0.04), 0 1px 2px rgba(20, 16, 10, 0.03)',
        md: '0 8px 24px -8px rgba(20, 16, 10, 0.1), 0 2px 8px -4px rgba(20, 16, 10, 0.06)',
        glow: '0 0 24px -4px rgba(106, 76, 255, 0.35)',
        'glow-sm': '0 0 12px -2px rgba(106, 76, 255, 0.25)',
      },
      letterSpacing: {
        tighter: '-0.025em',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease both',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
