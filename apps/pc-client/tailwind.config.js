/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: "#07070a",
        bgPanel: "rgba(13, 13, 21, 0.7)",
        accentGold: "#ffaa00",
        accentBlue: "#00d4ff",
        textMuted: "#8f93a3",
      },
      boxShadow: {
        glowBlue: "0 0 20px rgba(0, 212, 255, 0.4)",
        glowGold: "0 0 20px rgba(255, 170, 0, 0.4)",
      },
    },
  },
  plugins: [],
}
