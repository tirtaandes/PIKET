/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef4ff',
          100: '#dbe8ff',
          200: '#bfd7ff',
          300: '#93bdff',
          400: '#6098ff',
          500: '#3b73f6',
          600: '#2552eb',
          700: '#1d3fd8',
          800: '#17329e',
          900: '#0f2544',
          950: '#09172c'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};
