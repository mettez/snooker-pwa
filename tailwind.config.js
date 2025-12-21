/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#12c0e2',
        background: '#101f22',
        surface: '#18282c',
      },
      fontFamily: {
        display: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        glow: '0 0 20px -5px rgba(18, 192, 226, 0.5)',
      },
    },
  },
  plugins: [],
};
