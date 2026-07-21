/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        violet: {
          DEFAULT: "hsl(var(--violet))",
          foreground: "hsl(var(--violet-foreground))",
        },
        magenta: {
          DEFAULT: "hsl(var(--magenta))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        profit: {
          DEFAULT: "hsl(var(--profit))",
          foreground: "hsl(var(--profit-foreground))",
        },
        loss: {
          DEFAULT: "hsl(var(--loss))",
          foreground: "hsl(var(--loss-foreground))",
        },
        pending: {
          DEFAULT: "hsl(var(--pending))",
        },
        glow: {
          DEFAULT: "hsl(var(--glow))",
          soft: "hsl(var(--glow-soft))",
        },
        rail: "hsl(var(--rail))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.2rem",
        "3xl": "1.6rem",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 56px -12px hsl(var(--glow) / 0.55)",
        "glow-sm": "0 0 28px -8px hsl(var(--glow) / 0.45)",
        "glow-violet": "0 0 48px -12px hsl(var(--violet) / 0.5)",
        glass:
          "0 0 0 1px rgba(255,255,255,0.04) inset, 0 16px 48px -14px rgba(0,0,0,0.6)",
        "glass-lg":
          "0 0 0 1px rgba(255,255,255,0.05) inset, 0 28px 72px -18px rgba(0,0,0,0.7)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(125deg, hsl(168 95% 55%) 0%, hsl(192 100% 58%) 40%, hsl(275 85% 68%) 80%, hsl(310 85% 65%) 100%)",
        "mesh-dark":
          "radial-gradient(at 12% 8%, hsl(168 80% 40% / 0.16) 0px, transparent 42%), radial-gradient(at 90% 10%, hsl(192 100% 50% / 0.12) 0px, transparent 40%), radial-gradient(at 50% 100%, hsl(275 70% 45% / 0.12) 0px, transparent 48%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 24px -8px hsl(var(--glow) / 0.35)" },
          "50%": { boxShadow: "0 0 40px -4px hsl(var(--glow) / 0.65)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        aurora: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.05)" },
        },
        gradientShift: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in-scale": "fade-in-scale 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulseGlow 2.8s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
        aurora: "aurora 8s ease-in-out infinite",
        "gradient-shift": "gradientShift 6s ease infinite",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
