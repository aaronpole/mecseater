/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './lib/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: '#11100F',
        surface: '#1B1917',
        primary: '#F97316',
        'primary-hover': '#FB923C',
        text: '#FAF7F2',
        muted: '#A8A29E',
        border: '#38312C',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(249, 115, 22, 0.18)',
      },
    },
  },
  plugins: [],
};

