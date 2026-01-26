/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light mode base
        surface: '#FFFFFF',
        background: '#F5F5F5',
        border: '#000000',
        
        // Monochrome accents
        primary: '#000000',
        muted: '#6B7280',
        
        // Electric blue brand colors
        electric: '#0066FF',
        'electric-dark': '#0052CC',
        'electric-light': '#3385FF',
        'electric-glow': 'rgba(0, 102, 255, 0.4)',
        
        // Semantic
        accent: '#374151',
        'accent-hover': '#1F2937',
        
        // Text
        'text-primary': '#000000',
        'text-muted': '#6B7280',
        'text-inverse': '#FFFFFF',
      },
      boxShadow: {
        'electric-glow': '0 0 20px rgba(0, 102, 255, 0.4)',
        'electric-glow-lg': '0 0 40px rgba(0, 102, 255, 0.5)',
        'electric-glow-sm': '0 0 10px rgba(0, 102, 255, 0.3)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderWidth: {
        '1': '1px',
      },
    },
  },
  plugins: [],
}
