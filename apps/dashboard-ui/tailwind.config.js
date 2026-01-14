/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)'
        },
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          fg: 'rgb(var(--color-primary-fg) / <alpha-value>)'
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          fg: 'rgb(var(--color-success-fg) / <alpha-value>)'
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          fg: 'rgb(var(--color-danger-fg) / <alpha-value>)'
        }
      },
      borderRadius: {
        xl: '1rem'
      }
    }
  },
  plugins: []
};
