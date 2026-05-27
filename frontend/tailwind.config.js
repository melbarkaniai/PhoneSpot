/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          text: '#1D1D1F',
          muted: '#6E6E73',
          border: '#D2D2D7',
          accent: '#0071E3',
          'accent-hover': '#0077ED',
          black: '#1D1D1F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        pill: '980px',
        card: '18px',
        input: '12px',
      },
    },
  },
  plugins: [],
}

