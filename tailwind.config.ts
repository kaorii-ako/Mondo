import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wabi: {
          bg:      '#f5f0e8',
          surface: '#ede8df',
          border:  '#c9b99a',
          primary: '#8b7355',
          dark:    '#3d2e1e',
          muted:   '#7a6a55',
          light:   '#d4c5a9',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif JP"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
export default config
