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
          darker: '#020202',
          green: '#00ff41',
          greenDark: '#008f11',
          greenGlow: 'rgba(0, 255, 65, 0.2)',
        }
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        display: ['"Share Tech Mono"', 'monospace'],
      },
      animation: {
        'glitch': 'glitch 1s linear infinite',
        'crt-flicker': 'flicker 0.15s infinite',
        'scanline': 'scanline 10s linear infinite',
      },
      backgroundImage: {
        'scanlines': 'linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.25) 51%)',
      }
    }
  },
  plugins: [],
}
