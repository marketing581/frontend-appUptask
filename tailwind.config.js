/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /** Superficies: fondo azulado muy claro, tarjetas blancas con borde
         *  sutil en lugar de sombras pesadas. */
        canvas: '#f5f6fa',
        surface: '#ffffff',
        'surface-sunken': '#fafbfc',

        line: {
          DEFAULT: '#e4e6ef',
          strong: '#d0d3e0',
        },

        ink: {
          DEFAULT: '#1c1f33',
          muted: '#5a6079',
          subtle: '#868ca3',
        },

        brand: {
          50: '#f4f1ff',
          100: '#ebe4ff',
          200: '#d9cdff',
          300: '#bda6ff',
          400: '#9c74ff',
          500: '#7f45f5',
          600: '#7028e8',
          700: '#5f1cc7',
          800: '#4f1aa2',
          900: '#421885',
        },

        /** Paleta del avance del trabajo. */
        stage: {
          pending: '#0ea5e9',
          progress: '#7c3aed',
          validate: '#f59e0b',
          done: '#059669',
          alert: '#dc2626',
        },
      },
      fontSize: {
        /** Escala densa, al estilo de las herramientas de gestión: los
         *  títulos no compiten con el contenido. */
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.125rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.625rem' }],
        '2xl': ['1.375rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.75rem', { lineHeight: '2.125rem' }],
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.625rem',
        xl: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(28 31 51 / 0.04)',
        raised: '0 2px 8px -2px rgb(28 31 51 / 0.12), 0 1px 3px -1px rgb(28 31 51 / 0.08)',
        overlay: '0 12px 32px -8px rgb(28 31 51 / 0.22), 0 4px 12px -4px rgb(28 31 51 / 0.12)',
      },
      spacing: {
        sidebar: '15rem',
        'sidebar-collapsed': '3.5rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}
