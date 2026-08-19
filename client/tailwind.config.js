/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hytale: {
          bg: '#0b0f17',
          card: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(255, 255, 255, 0.1)',
          emerald: '#10b981',
          emeraldDark: '#059669',
          cyan: '#06b6d4',
          gold: '#f59e0b',
        }
      },
      backgroundImage: {
        'hero-pattern': "radial-gradient(ellipse at top, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(ellipse at bottom, rgba(6, 182, 212, 0.1), transparent 70%)",
      },
      boxShadow: {
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.5)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.5)',
      }
    },
  },
  plugins: [],
}
