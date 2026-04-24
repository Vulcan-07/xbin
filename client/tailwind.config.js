/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hacker: {
          dark: '#0a0a0a',
          darker: '#000000',
          green: '#00ff00',
          greenDark: '#008000',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', '"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
