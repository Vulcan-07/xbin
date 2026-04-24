/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          base: '#0B1120',      
          surface: '#121B2A',   
          surfaceHover: '#1A2436',
          border: '#1E293B',    
          accent: '#06b6d4', // Cyan
          blue: '#3b82f6',   // Electric Blue
          violet: '#8b5cf6', // Violet
          text: '#94A3B8',
          textBright: '#F8FAFC'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'waveform': 'waveform 3s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite alternate',
        'gradient-xy': 'gradientXY 10s ease infinite',
      },
      keyframes: {
        gradientXY: {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        }
      }
    }
  },
  plugins: [],
}
