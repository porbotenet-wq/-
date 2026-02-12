/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tg: {
          bg: 'var(--tg-theme-bg-color, #1a1a2e)',
          text: 'var(--tg-theme-text-color, #e0e0e0)',
          hint: 'var(--tg-theme-hint-color, #999)',
          link: 'var(--tg-theme-link-color, #3ecf8e)',
          button: 'var(--tg-theme-button-color, #3ecf8e)',
          buttonText: 'var(--tg-theme-button-text-color, #000)',
          secondary: 'var(--tg-theme-secondary-bg-color, #16213e)',
          header: 'var(--tg-theme-header-bg-color, #0f3460)',
        },
      },
    },
  },
  plugins: [],
};
