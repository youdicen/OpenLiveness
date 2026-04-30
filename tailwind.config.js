/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian Design System
        bg: '#09090b',
        surface: {
          DEFAULT: '#0c0c0f',
          mid: '#141417',
          elevated: '#1c1c1f',
          high: '#27272a',
        },
        primary: '#a78bfa',    // soft violet
        tertiary: '#34d399',   // emerald green - success
        error: '#ef4444',      // red - errors only
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
        },
        border: '#27272a',
        'border-subtle': '#18181b',
      },
      fontFamily: {
        sans: ['Geist Variable', 'Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono Variable', 'Geist Mono', 'monospace'],
      },
      letterSpacing: {
        tight: '-0.02em',
      },
      borderRadius: {
        card: '8px',
        pill: '9999px',
        container: '16px',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'fade-up': 'fade-up 0.6s ease forwards',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.85)' },
        },
        'scan-line': {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
