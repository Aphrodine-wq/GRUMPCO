/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx,svelte}",
  ],
  theme: {
    extend: {
      colors: {
        // Core
        background: 'var(--color-bg-app)',
        surface: 'var(--color-bg-card)',
        subtle: 'var(--color-bg-subtle)',

        // Text
        primary: 'var(--color-text)',
        secondary: 'var(--color-text-secondary)',
        muted: 'var(--color-text-muted)',
        inverse: 'var(--color-text-inverse)',

        // Brand
        electric: 'var(--color-primary)',
        'electric-hover': 'var(--color-primary-hover)',

        // Semantic
        success: 'var(--color-success)',
        error: 'var(--color-error)',
        warning: 'var(--color-warning)',

        // Boarders
        border: 'var(--color-border)',
        'border-light': 'var(--color-border-light)',
      },
      boxShadow: {
        glow: 'var(--shadow-glow)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', '"Segoe UI"', 'Arial', 'sans-serif'],
        mono: ['"Space Mono"', '"SF Mono"', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      }
    },
  },
  plugins: [],
}
