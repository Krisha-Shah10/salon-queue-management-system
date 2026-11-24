/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm ivory — primary backgrounds (light theme)
        ivory: {
          50:  '#FDFAF4',
          100: '#FAF5EC',
          200: '#F3EBD9',
          300: '#E8DCC5',
          400: '#D9C9A8',
        },
        // Deep charcoal — text, dark sections, staff screens
        charcoal: {
          950: '#0E0E10',
          900: '#1C1C1E',
          800: '#2A2A2D',
          750: '#323237',
          700: '#3A3A3E',
          600: '#6B6B73',
          500: '#8C8C96',
          400: '#AEAEB8',
          300: '#C7C7CC',
          200: '#E5E5EA',
          100: '#F2F2F7',
        },
        // Champagne gold — brand accent
        gold: {
          950: '#1A1200',
          900: '#2E2000',
          800: '#4A3400',
          700: '#6B4C00',
          600: '#8F6700',
          500: '#C9A84C',   // champagne gold — primary
          400: '#D4B86A',
          300: '#DEC98A',
          200: '#EBE0BC',
          100: '#F7F2E4',
          50:  '#FDFBF2',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'warm':     '0 2px 16px 0 rgba(100, 80, 40, 0.08)',
        'warm-md':  '0 4px 24px 0 rgba(100, 80, 40, 0.12)',
        'warm-lg':  '0 8px 40px 0 rgba(100, 80, 40, 0.16)',
        'warm-xl':  '0 16px 64px 0 rgba(100, 80, 40, 0.20)',
        'gold':     '0 4px 20px 0 rgba(201, 168, 76, 0.30)',
        'inner-warm': 'inset 0 1px 4px 0 rgba(100, 80, 40, 0.06)',
      },
      animation: {
        fadeIn:    'fadeIn 0.4s ease-out both',
        slideUp:   'slideUp 0.5s ease-out both',
        slideDown: 'slideDown 0.4s ease-out both',
        scaleIn:   'scaleIn 0.3s ease-out both',
        shimmer:   'shimmer 2s linear infinite',
        pulseSlow: 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        marquee:   'marquee 30s linear infinite',
        shake:     'shake 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':  { transform: 'translateX(-8px)' },
          '40%':  { transform: 'translateX(8px)' },
          '60%':  { transform: 'translateX(-6px)' },
          '80%':  { transform: 'translateX(6px)' },
        },
      },
      backgroundImage: {
        'ivory-texture': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A84C' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
