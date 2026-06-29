/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Light soft-UI / pastel bento system ──
        paper: "#F6F7FB",         // app background (very light cool gray)
        surface: "#FFFFFF",       // cards / panels
        "surface-2": "#F3F4F8",   // subtle inset
        ink: "#1B1B2F",           // primary text (deep navy-ink)
        "ink-soft": "#41415C",    // secondary headings
        muted: "#8A8AA0",         // secondary text
        line: "#ECEDF3",          // borders
        "line-soft": "#F3F4F8",   // faint dividers

        // ── Brand (silver / brushed steel) ──
        accent: "#5B6677",
        "accent-hover": "#454E5E",
        "accent-soft": "#EDEFF3",
        "accent-ring": "#94A3B8",

        // ── Secondary highlight ──
        cta: "#F59E0B",
        "cta-hover": "#D97706",

        // ── Semantic + pastel tints (for bento cards) ──
        success: "#0FB07E",
        "success-soft": "#E3F7EE",
        warning: "#E0A800",
        "warning-soft": "#FEF6E0",
        info: "#3B82F6",
        "info-soft": "#E6F0FE",
        danger: "#EF4444",
        "danger-soft": "#FDECEC",

        // ── Extra pastel accents for variety ──
        lavender: "#ECEAFE",
        lemon: "#FEF6E0",
        mint: "#E3F7EE",
        sky: "#E6F0FE",
        rose: "#FDECEC",
        peach: "#FFEFE3",
      },
      fontFamily: {
        sans: ['"Open Sans"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Poppins"', '"Open Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        // Soft, layered "bento" shading
        xs: "0 1px 2px 0 rgb(27 27 47 / 0.04)",
        sm: "0 1px 3px 0 rgb(27 27 47 / 0.06), 0 1px 2px -1px rgb(27 27 47 / 0.04)",
        card: "0 1px 2px rgb(27 27 47 / 0.04), 0 10px 28px -14px rgb(27 27 47 / 0.14)",
        soft: "0 8px 30px -12px rgb(27 27 47 / 0.16)",
        pop: "0 24px 60px -18px rgb(27 27 47 / 0.24)",
        ring: "0 0 0 4px rgb(91 102 119 / 0.18)",
        // Soft metallic accent shadows
        "glow-violet": "0 10px 26px -10px rgb(71 82 100 / 0.45)",
        "glow-blue": "0 10px 26px -10px rgb(100 116 139 / 0.40)",
        "glow-soft": "0 1px 2px rgb(27 27 47 / 0.05), 0 12px 34px -16px rgb(91 102 119 / 0.28)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.9" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s ease-out",
        "scale-in": "scale-in 0.15s ease-out",
        "slide-in-left": "slide-in-left 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "glow-pulse": "glow-pulse 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
