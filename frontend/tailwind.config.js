/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        surface: {
          0: "rgb(var(--surface-0) / <alpha-value>)",
          1: "rgb(var(--surface-1) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
          3: "rgb(var(--surface-3) / <alpha-value>)",
        },
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          muted:   "rgb(var(--fg-muted) / <alpha-value>)",
          subtle:  "rgb(var(--fg-subtle) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          dark:    "rgb(var(--accent-dark) / <alpha-value>)",
          dim:     "rgb(var(--accent-dim) / <alpha-value>)",
          subtle:  "rgb(var(--accent-subtle) / <alpha-value>)",
          border:  "rgb(var(--accent-border) / <alpha-value>)",
        },
      },
      animation: {
        "wave-bar":   "waveBar 1s ease-in-out infinite",
        "blink":      "blink 1.4s step-start infinite",
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        waveBar: {
          "0%, 100%": { transform: "scaleY(0.25)" },
          "50%":      { transform: "scaleY(1)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
