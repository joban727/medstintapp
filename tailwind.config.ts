import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        "3xl": "1920px",
        "4xl": "2560px",
        "5xl": "3840px",
      },
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
        // Enhanced Medical Color Palette
        "medical-primary": {
          DEFAULT: "hsl(var(--medical-primary) / <alpha-value>)",
          light: "hsl(var(--medical-primary-light) / <alpha-value>)",
          dark: "hsl(var(--medical-primary-dark) / <alpha-value>)",
          hover: "hsl(var(--medical-primary-hover) / <alpha-value>)",
        },
        "healthcare-green": {
          DEFAULT: "hsl(var(--healthcare-green) / <alpha-value>)",
          light: "hsl(var(--healthcare-green-light) / <alpha-value>)",
          dark: "hsl(var(--healthcare-green-dark) / <alpha-value>)",
          hover: "hsl(var(--healthcare-green-hover) / <alpha-value>)",
        },
        "medical-teal": {
          DEFAULT: "hsl(var(--medical-teal) / <alpha-value>)",
          light: "hsl(var(--medical-teal-light) / <alpha-value>)",
          dark: "hsl(var(--medical-teal-dark) / <alpha-value>)",
        },
        "medical-cyan": {
          DEFAULT: "hsl(var(--medical-cyan) / <alpha-value>)",
          light: "hsl(var(--medical-cyan-light) / <alpha-value>)",
          dark: "hsl(var(--medical-cyan-dark) / <alpha-value>)",
        },
        "professional-gray": {
          DEFAULT: "hsl(var(--professional-gray) / <alpha-value>)",
          light: "hsl(var(--professional-gray-light) / <alpha-value>)",
          dark: "hsl(var(--professional-gray-dark) / <alpha-value>)",
        },
        // Status Colors
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          light: "hsl(var(--success-light) / <alpha-value>)",
          dark: "hsl(var(--success-dark) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          light: "hsl(var(--warning-light) / <alpha-value>)",
          dark: "hsl(var(--warning-dark) / <alpha-value>)",
        },
        error: {
          DEFAULT: "hsl(var(--error) / <alpha-value>)",
          light: "hsl(var(--error-light) / <alpha-value>)",
          dark: "hsl(var(--error-dark) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          light: "hsl(var(--info-light) / <alpha-value>)",
          dark: "hsl(var(--info-dark) / <alpha-value>)",
        },
        // Surface Colors
        surface: {
          1: "hsl(var(--surface-1) / <alpha-value>)",
          2: "hsl(var(--surface-2) / <alpha-value>)",
          3: "hsl(var(--surface-3) / <alpha-value>)",
          4: "hsl(var(--surface-4) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        serif: ["var(--font-serif)"],
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
        "5xl": "var(--text-5xl)",
        "6xl": "var(--text-6xl)",
      },
      lineHeight: {
        tight: "var(--leading-tight)",
        normal: "var(--leading-normal)",
        relaxed: "var(--leading-relaxed)",
      },
      letterSpacing: {
        tight: "var(--tracking-tight)",
        normal: "var(--tracking-normal)",
        wide: "var(--tracking-wide)",
        wider: "var(--tracking-wider)",
      },
      boxShadow: {
        "2xs": "var(--shadow-2xs)",
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
      },
      spacing: {
        0: "var(--spacing-0)",
        1: "var(--spacing-1)",
        2: "var(--spacing-2)",
        3: "var(--spacing-3)",
        4: "var(--spacing-4)",
        5: "var(--spacing-5)",
        6: "var(--spacing-6)",
        8: "var(--spacing-8)",
        10: "var(--spacing-10)",
        12: "var(--spacing-12)",
        16: "var(--spacing-16)",
        20: "var(--spacing-20)",
        24: "var(--spacing-24)",
        32: "var(--spacing-32)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        blob: {
          "0%": {
            transform: "translate(0px, 0px) scale(1)",
          },
          "33%": {
            transform: "translate(30px, -50px) scale(1.1)",
          },
          "66%": {
            transform: "translate(-20px, 20px) scale(0.9)",
          },
          "100%": {
            transform: "translate(0px, 0px) scale(1)",
          },
        },
        tilt: {
          "0%, 50%, 100%": {
            transform: "rotate(0deg)",
          },
          "25%": {
            transform: "rotate(0.5deg)",
          },
          "75%": {
            transform: "rotate(-0.5deg)",
          },
        },
        shimmer: {
          from: {
            backgroundPosition: "0 0",
          },
          to: {
            backgroundPosition: "-200% 0",
          },
        },
        "gradient-x": {
          "0%, 100%": {
            "background-size": "200% 200%",
            "background-position": "left center",
          },
          "50%": {
            "background-size": "200% 200%",
            "background-position": "right center",
          },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "xray-scan": {
          "0%": {
            transform: "translateY(-100%)",
            opacity: "0",
          },
          "10%": {
            opacity: "1",
          },
          "90%": {
            opacity: "1",
          },
          "100%": {
            transform: "translateY(100vh)",
            opacity: "0",
          },
        },
      },
      animation: {
        "fade-in": "var(--animate-fade-in)",
        "slide-up": "var(--animate-slide-up)",
        "scale-in": "var(--animate-scale-in)",
        "spin-slow": "var(--animate-spin-slow)",
        blob: "blob 7s infinite",
        marquee: "marquee 25s linear infinite",
        tilt: "tilt 10s infinite linear",
        shimmer: "shimmer 2s linear infinite",
        "gradient-x": "gradient-x 15s ease infinite",
        float: "float 6s ease-in-out infinite",
        "xray-scan": "xray-scan 4s ease-in-out infinite",
      },
      zIndex: {
        0: "var(--z-0)",
        10: "var(--z-10)",
        20: "var(--z-20)",
        30: "var(--z-30)",
        40: "var(--z-40)",
        50: "var(--z-50)",
        auto: "var(--z-auto)",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
        "gradient-accent": "var(--gradient-accent)",
        "gradient-subtle": "var(--gradient-subtle)",
      },
    },
  },
  plugins: [],
}

export default config