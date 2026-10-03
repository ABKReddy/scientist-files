/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#04050a',
        ink: '#070911',
        charcoal: '#0b0e18',
        steel: '#131829',
        graphite: '#1c2336',
        ash: '#6b7690',
        mist: '#aab3c7',
        crimson: {
          DEFAULT: '#ff2d55',
          soft: '#ff5c78',
          deep: '#8c0f2a',
        },
        electric: {
          DEFAULT: '#3d7bff',
          soft: '#6fa0ff',
          glow: '#00d4ff',
        },
        amber: '#ffb347',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 0 1px rgba(255,45,85,0.35), 0 0 28px rgba(255,45,85,0.35)',
        'glow-blue': '0 0 0 1px rgba(61,123,255,0.35), 0 0 28px rgba(61,123,255,0.30)',
        'glass': '0 18px 50px rgba(0,0,0,0.55)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(61,123,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(61,45,85,0.07) 1px, transparent 1px)',
        'radial-red': 'radial-gradient(circle at 50% 0%, rgba(255,45,85,0.18), transparent 55%)',
        'radial-blue': 'radial-gradient(circle at 50% 100%, rgba(61,123,255,0.16), transparent 55%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'letter-spread': {
          '0%': { opacity: '0', letterSpacing: '0.9em', filter: 'blur(10px)' },
          '100%': { opacity: '1', letterSpacing: '0.34em', filter: 'blur(0px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.7', transform: 'scale(0.85)' },
          '70%': { opacity: '0', transform: 'scale(1.6)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '45%': { opacity: '1' },
          '46%': { opacity: '0.55' },
          '48%': { opacity: '1' },
          '72%': { opacity: '1' },
          '73%': { opacity: '0.7' },
          '75%': { opacity: '1' },
        },
        drift: {
          '0%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(12px,-18px,0)' },
          '100%': { transform: 'translate3d(0,0,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.6s ease both',
        'letter-spread': 'letter-spread 1.4s cubic-bezier(0.16,1,0.3,1) both',
        'scan-line': 'scan-line 7s linear infinite',
        'pulse-ring': 'pulse-ring 2.8s ease-out infinite',
        flicker: 'flicker 6s linear infinite',
        drift: 'drift 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};