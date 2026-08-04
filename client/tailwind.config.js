/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0e1217",
        "bg-card": "#161d24",
        "bg-input": "#1a2230",
        "bg-hover": "#1e2a38",
        "brand-green": "#1bd96a",
        "brand-teal": "#00b7c3",
        "text-primary": "#e8edf3",
        "text-secondary": "#8fa0b3",
        "text-muted": "#566878",
        "status-online": "#1bd96a",
        "status-offline": "#f45d5d",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-right": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
        "slide-right": "slide-right 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
