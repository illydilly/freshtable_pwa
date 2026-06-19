/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sage: '#7FB069',
        coral: '#FF6B6B',
        surface: '#FAFAFA',
        border: '#F1F5F9'
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        card: '0 8px 30px rgba(15, 23, 42, 0.05)'
      }
    }
  },
  plugins: []
};
