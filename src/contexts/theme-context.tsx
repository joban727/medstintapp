"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

export type ThemeColor = "slate" | "orange" | "indigo" | "purple" | "emerald" | "rose" | "amber" | "blue"
export type GlassPreset = "off" | "subtle" | "normal" | "strong" | "custom"
export type ThemeFont = "inter" | "manrope" | "outfit" | "roboto"

export interface GlassSettings {
  preset: GlassPreset
  opacity: number      // 0 - 0.20
  blur: number         // 0 - 40
  borderOpacity: number // 0 - 0.30
  saturation: number   // 100 - 200
  hoverOpacityAdd: number
  hoverBorderAdd: number
}

interface ThemeColors {
  primary: string
  primaryRgb: string
  gradientFrom: string
  gradientTo: string
  name: string
}

export const GLASS_PRESETS: Record<Exclude<GlassPreset, "custom">, Omit<GlassSettings, "preset">> = {
  off: { opacity: 0, blur: 0, borderOpacity: 0.10, saturation: 100, hoverOpacityAdd: 0.02, hoverBorderAdd: 0.05 },
  subtle: { opacity: 0.06, blur: 16, borderOpacity: 0.10, saturation: 150, hoverOpacityAdd: 0.02, hoverBorderAdd: 0.05 },
  normal: { opacity: 0.12, blur: 24, borderOpacity: 0.18, saturation: 180, hoverOpacityAdd: 0.02, hoverBorderAdd: 0.05 },
  strong: { opacity: 0.18, blur: 32, borderOpacity: 0.25, saturation: 200, hoverOpacityAdd: 0.02, hoverBorderAdd: 0.05 }
}

const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  preset: "subtle",
  ...GLASS_PRESETS.subtle
}

const themeColorMap: Record<ThemeColor, ThemeColors> = {
  slate: {
    primary: "215 25% 63%",
    primaryRgb: "148, 162, 180",
    gradientFrom: "#94a2b4",
    gradientTo: "#7a8a9e",
    name: "Slate"
  },
  orange: {
    primary: "25 70% 63%",
    primaryRgb: "217, 152, 105",
    gradientFrom: "#d99869",
    gradientTo: "#c78555",
    name: "Peach"
  },
  indigo: {
    primary: "239 50% 68%",
    primaryRgb: "150, 153, 200",
    gradientFrom: "#9699c8",
    gradientTo: "#8385ba",
    name: "Lavender"
  },
  purple: {
    primary: "270 45% 68%",
    primaryRgb: "175, 150, 200",
    gradientFrom: "#af96c8",
    gradientTo: "#9880b0",
    name: "Lilac"
  },
  emerald: {
    primary: "160 40% 58%",
    primaryRgb: "117, 168, 148",
    gradientFrom: "#75a894",
    gradientTo: "#5d9580",
    name: "Sage"
  },
  rose: {
    primary: "350 50% 68%",
    primaryRgb: "200, 140, 150",
    gradientFrom: "#c88c96",
    gradientTo: "#b57882",
    name: "Rose"
  },
  amber: {
    primary: "45 55% 63%",
    primaryRgb: "195, 175, 120",
    gradientFrom: "#c3af78",
    gradientTo: "#b09c65",
    name: "Gold"
  },
  blue: {
    primary: "210 50% 65%",
    primaryRgb: "130, 165, 200",
    gradientFrom: "#82a5c8",
    gradientTo: "#6a90b5",
    name: "Sky"
  }
}

const fontMap: Record<ThemeFont, string> = {
  inter: "'Inter', sans-serif",
  manrope: "'Manrope', sans-serif",
  outfit: "'Outfit', sans-serif",
  roboto: "'Roboto', sans-serif",
}

interface ThemeContextValue {
  // Theme color
  themeColor: ThemeColor
  setThemeColor: (color: ThemeColor) => void
  themeColors: ThemeColors

  // Glass settings
  glassSettings: GlassSettings
  setGlassPreset: (preset: GlassPreset) => void
  setCustomGlassSettings: (settings: Partial<GlassSettings>) => void

  // Background color
  bgColor: string
  setBgColor: (color: string) => void

  // Font
  themeFont: ThemeFont
  setThemeFont: (font: ThemeFont) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}

// Backwards compatibility alias for existing code that uses useEnhancedTheme
export function useEnhancedTheme() {
  const theme = useTheme()
  return {
    ...theme,
    // Provide a config object for compatibility
    config: {
      themeColor: theme.themeColor,
      glassSettings: theme.glassSettings,
      bgColor: theme.bgColor,
      themeFont: theme.themeFont,
    }
  }
}

interface ThemeProviderProps {
  children: ReactNode
}

export function EnhancedThemeProvider({ children }: ThemeProviderProps) {
  const [themeColor, setThemeColorState] = useState<ThemeColor>("slate")
  const [glassSettings, setGlassSettings] = useState<GlassSettings>(DEFAULT_GLASS_SETTINGS)
  const [bgColor, setBgColorState] = useState("#0a0a0a")
  const [themeFont, setThemeFontState] = useState<ThemeFont>("inter")
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true)

    const savedColor = localStorage.getItem("theme-color") as ThemeColor
    if (savedColor && themeColorMap[savedColor]) {
      setThemeColorState(savedColor)
    }

    const savedGlass = localStorage.getItem("theme-glass")
    if (savedGlass) {
      try {
        setGlassSettings(JSON.parse(savedGlass))
      } catch { }
    }

    const savedBgColor = localStorage.getItem("theme-bg-color")
    if (savedBgColor) {
      setBgColorState(savedBgColor)
    }

    const savedFont = localStorage.getItem("theme-font") as ThemeFont
    if (savedFont && fontMap[savedFont]) {
      setThemeFontState(savedFont)
    }
  }, [])

  // Apply CSS variables when values change
  useEffect(() => {
    if (!mounted) return

    const colors = themeColorMap[themeColor]
    const d = document.documentElement

    d.style.setProperty("--theme-primary", colors.primary)
    d.style.setProperty("--theme-primary-rgb", colors.primaryRgb)
    d.style.setProperty("--theme-gradient-from", colors.gradientFrom)
    d.style.setProperty("--theme-gradient-to", colors.gradientTo)

    localStorage.setItem("theme-color", themeColor)
  }, [themeColor, mounted])

  useEffect(() => {
    if (!mounted) return

    const d = document.documentElement
    d.style.setProperty("--glass-opacity", String(glassSettings.opacity))
    d.style.setProperty("--glass-blur", `${glassSettings.blur}px`)
    d.style.setProperty("--glass-border-opacity", String(glassSettings.borderOpacity))
    d.style.setProperty("--glass-saturation", `${glassSettings.saturation}%`)
    d.style.setProperty("--glass-hover-opacity-add", String(glassSettings.hoverOpacityAdd))
    d.style.setProperty("--glass-hover-border-add", String(glassSettings.hoverBorderAdd))

    localStorage.setItem("theme-glass", JSON.stringify(glassSettings))
  }, [glassSettings, mounted])

  useEffect(() => {
    if (!mounted) return

    document.documentElement.style.setProperty("--theme-bg-color", bgColor)
    localStorage.setItem("theme-bg-color", bgColor)
  }, [bgColor, mounted])

  useEffect(() => {
    if (!mounted) return

    document.documentElement.style.setProperty("--font-sans", fontMap[themeFont])
    localStorage.setItem("theme-font", themeFont)
  }, [themeFont, mounted])

  const setThemeColor = (color: ThemeColor) => {
    setThemeColorState(color)
  }

  const setGlassPreset = (preset: GlassPreset) => {
    if (preset === "custom") {
      setGlassSettings(prev => ({ ...prev, preset }))
    } else {
      setGlassSettings({ preset, ...GLASS_PRESETS[preset] })
    }
  }

  const setCustomGlassSettings = (settings: Partial<GlassSettings>) => {
    setGlassSettings(prev => ({ ...prev, ...settings, preset: "custom" }))
  }

  const setBgColor = (color: string) => {
    setBgColorState(color)
  }

  const setThemeFont = (font: ThemeFont) => {
    setThemeFontState(font)
  }

  const value: ThemeContextValue = {
    themeColor,
    setThemeColor,
    themeColors: themeColorMap[themeColor],
    glassSettings,
    setGlassPreset,
    setCustomGlassSettings,
    bgColor,
    setBgColor,
    themeFont,
    setThemeFont
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}