import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./base/**/*.{js,ts,jsx,tsx}",
    "./whitbyos/**/*.{js,ts,jsx,tsx}",
    "./client-portal/**/*.{js,ts,jsx,tsx}",
    "./academy/**/*.{js,ts,jsx,tsx}",
    "./partner-center/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
        },
        canvas: "var(--canvas)",
        surface: {
          DEFAULT: "var(--surface)",
          soft: "var(--surface-soft)",
          subtle: "var(--surface-subtle)",
        },
        line: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
          dashed: "var(--border-dashed)",
        },
        /* Brent marketing landing (MusaNWO design/brent) */
        "pa-bg": "var(--pa-paper, #f8f8fa)",
        "pa-ink": "var(--pa-ink, #13151e)",
        "pa-line": "var(--pa-line, #e8e9ed)",
        "pa-blue": "var(--pa-blue, #2381ff)",
        "pa-blue-dark": "var(--pa-blue-dark, #1a66d4)",
        "pa-cream": "var(--pa-cream, #e8e9ed)",
        "pa-panel": "var(--pa-panel, #f0f0f2)",
        "pa-soft": "var(--pa-tint, #dce9f9)",
        "pa-tint": "var(--pa-tint, #dce9f9)",
        "pa-halo": "var(--pa-halo, #c5daf5)",
        "pa-mauve": "var(--pa-mauve, #e8f1fc)",
        "pa-muted": "var(--pa-muted, #5a5c62)",
        "pa-deep": "var(--pa-deep, #143357)",
        "pa-amber": "var(--pa-amber, #fde3c2)",
        "pa-amber-ink": "var(--pa-amber-ink, #8a5a1e)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        "inter-tight": [
          "var(--font-inter-tight)",
          '"Inter Tight"',
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,15,15,.1)",
        float: "0 6px 20px rgba(15,15,15,.06)",
        hero: "0 12px 40px rgba(15,15,15,.08)",
      },
      borderRadius: {
        control: "6px",
        card: "10px",
        "card-cp": "8px",
        swatch: "9px",
      },
    },
  },
  plugins: [],
};

export default config;
