import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        grid: "hsl(var(--grid))",
        card: "hsl(var(--card))",
        panel: "hsl(var(--panel))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        destructive: "hsl(var(--destructive))",
        ring: "hsl(var(--ring))",
        signal: {
          low: "hsl(var(--signal-low))",
          medium: "hsl(var(--signal-medium))",
          high: "hsl(var(--signal-high))",
          critical: "hsl(var(--signal-critical))",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        lg: "4px",
        md: "3px",
        sm: "2px",
      },
      boxShadow: {
        panel: "0 1px 0 0 hsl(var(--border-strong) / 0.4), 0 18px 40px -28px rgb(0 0 0 / 0.9)",
        glow: "0 0 0 1px hsl(var(--primary) / 0.5), 0 0 22px -6px hsl(var(--primary) / 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
