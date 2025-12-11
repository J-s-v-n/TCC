/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0b1220',
        ocean: '#0f172a',
        accent: '#3bc1ff',
        accentDark: '#0d9fec',
        card: '#11192e',
        border: '#1c2842',
      },
      boxShadow: {
        glow: '0 12px 50px rgba(59, 193, 255, 0.18)',
      },
      backgroundImage: {
        'hero-grid':
          'radial-gradient(circle at 20% 20%, rgba(59,193,255,0.08) 0, transparent 28%), radial-gradient(circle at 80% 0%, rgba(59,193,255,0.12) 0, transparent 30%), radial-gradient(circle at 50% 70%, rgba(13,159,236,0.12) 0, transparent 28%)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(-2%, 1%, 0)' },
        },
        pulseBg: {
          '0%': { backgroundPosition: '0 0, 0 0, 0 0' },
          '50%': { backgroundPosition: '20px 30px, -30px 10px, 15px -25px' },
          '100%': { backgroundPosition: '0 0, 0 0, 0 0' },
        },
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
        pulseBg: 'pulseBg 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

