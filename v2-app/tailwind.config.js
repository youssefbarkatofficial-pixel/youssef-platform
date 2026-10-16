/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme tokens (dual-theme + light/dark responsive)
        theme: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          'surface-hover': 'var(--bg-surface-hover)',
          elevated: 'var(--bg-elevated)',
          border: 'var(--border-subtle)',
          'border-focus': 'var(--border-focus)',
          gold: 'var(--brand-gold)',
          'gold-hover': 'var(--brand-gold-hover)',
          'gold-subtle': 'var(--brand-gold-subtle)',
          accent: 'var(--brand-accent)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          'text-muted': 'var(--text-muted)',
        },
        // Static palette preserved for 100% backward compatibility
        navy: {
          50: '#eef3fb',
          100: '#d9e3f3',
          200: '#b3c7e6',
          300: '#86a3d0',
          400: '#5a7db5',
          500: '#3d5f98',
          600: '#2c4a7d',
          700: '#1f3961',
          800: '#12254a',
          900: '#0b1a33',
          950: '#071326',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faefd0',
          200: '#f4dda1',
          300: '#ecc56c',
          400: '#e2b252',
          500: '#D4A64F',
          600: '#b98736',
          700: '#966a2c',
          800: '#7a5628',
          900: '#654824',
        },
      },
      fontFamily: {
        sans: ['var(--font-ar)', 'system-ui', 'sans-serif'],
        num: ['var(--font-num)', 'sans-serif'],
      },
      boxShadow: {
        soft: 'var(--card-shadow, 0 8px 30px rgba(0, 0, 0, 0.25))',
        glow: 'var(--glow-shadow, 0 0 40px rgba(212, 166, 79, 0.25))',
      },
      borderRadius: {
        btn: 'var(--radius-btn, 0.75rem)',
        card: 'var(--radius-card, 1rem)',
      },
    },
  },
  plugins: [],
};
