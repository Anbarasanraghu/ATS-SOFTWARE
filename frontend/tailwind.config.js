/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        surface: "#FBFAF6",
        ink: "#1F1E1A",
        muted: "#6B6A63",
        line: "#E2DED3",
        accent: "#0F6E56",
        "accent-soft": "#E1F0EA",
        danger: "#A32D2D",
      },
    },
  },
  plugins: [],
};