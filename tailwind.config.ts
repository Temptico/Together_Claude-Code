import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  // shared/schema.ts defines Tailwind gradient class names for the Games
  // catalog (e.g. "from-indigo-500 to-purple-600") — without it in the scan,
  // those utilities never get generated since they appear nowhere under client/.
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["'Mulish'", "system-ui", "sans-serif"],
        display: ["'Baloo 2'", "'Mulish'", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        // Stops chosen so white text stays at 4.5:1 or better across the whole
        // gradient (the old lighter coral/peach was 1.8–2.8:1).
        "together-gradient": "linear-gradient(160deg, #c94a36 0%, #c74034 45%, #cc3a3a 100%)",
        "together-warm": "linear-gradient(135deg, #cc3a3a 0%, #c0501f 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
