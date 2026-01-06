"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

// Theme color options
export type ThemeColor = "slate" | "orange" | "indigo" | "purple" | "emerald" | "rose" | "amber" | "blue"

// Glass preset options
export type GlassPreset = "off" | "subtle" | "normal" | "strong" | "custom"

// Glass settings interface
export interface GlassSettings {
    preset: GlassPreset
    opacity: number      // 0 - 0.20
    blur: number         // 0 - 40
    borderOpacity: number // 0 - 0.30
    saturation: number   // 100 - 200
    hoverOpacityAdd: number   // 0 - 0.10
    hoverBorderAdd: number    // 0 - 0.15
}

// Theme color map with theme colors
interface ThemeColors {
    primary: string
    primaryRgb: string
    gradientFrom: string
    gradientTo: string
    name: string
}

// Glass presets
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

// Theme color definitions - muted/pastel palette
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
        gradientTo: "#5f9680",
        name: "Sage"
    },
    rose: {
        primary: "350 50% 68%",
        primaryRgb: "200, 145, 155",
        gradientFrom: "#c89199",
        gradientTo: "#b27c85",
        name: "Blush"
    },
    amber: {
        primary: "45 55% 63%",
        primaryRgb: "198, 175, 125",
        gradientFrom: "#c6af7d",
        gradientTo: "#b29c6a",
        name: "Sand"
    },
    blue: {
        primary: "210 50% 65%",
        primaryRgb: "135, 165, 200",
        gradientFrom: "#87a5c8",
        gradientTo: "#7292b2",
        name: "Sky"
    }
}

interface GlassThemeContextType {
    // Theme color
    themeColor: ThemeColor
    setThemeColor: (color: ThemeColor) => void
    colors: ThemeColors
    availableColors: { key: ThemeColor; colors: ThemeColors }[]
    // Glass settings
    glassSettings: GlassSettings
    setGlassPreset: (preset: GlassPreset) => void
    setGlassCustomValue: (key: keyof Omit<GlassSettings, "preset">, value: number) => void
    resetGlassToPreset: (preset: Exclude<GlassPreset, "custom">) => void
}

const GlassThemeContext = createContext<GlassThemeContextType | undefined>(undefined)

export function GlassThemeProvider({ children }: { children: ReactNode }) {
    const [themeColor, setThemeColorState] = useState<ThemeColor>("blue")
    const [glassSettings, setGlassSettingsState] = useState<GlassSettings>(DEFAULT_GLASS_SETTINGS)
    const [mounted, setMounted] = useState(false)

    // Load saved settings on mount
    useEffect(() => {
        setMounted(true)
        const savedColor = localStorage.getItem("glass-theme-color") as ThemeColor
        if (savedColor && themeColorMap[savedColor]) {
            setThemeColorState(savedColor)
        }
        const savedGlass = localStorage.getItem("glass-theme-settings")
        if (savedGlass) {
            try {
                const parsed = JSON.parse(savedGlass)
                setGlassSettingsState({ ...DEFAULT_GLASS_SETTINGS, ...parsed })
            } catch {
                // Use default on parse error
            }
        }
    }, [])

    // Apply theme color CSS variables
    useEffect(() => {
        if (!mounted) return
        const colors = themeColorMap[themeColor]
        const root = document.documentElement
        root.style.setProperty("--theme-primary", colors.primary)
        root.style.setProperty("--theme-primary-rgb", colors.primaryRgb)
        root.style.setProperty("--theme-gradient-from", colors.gradientFrom)
        root.style.setProperty("--theme-gradient-to", colors.gradientTo)
        localStorage.setItem("glass-theme-color", themeColor)
    }, [themeColor, mounted])

    // Apply glass CSS variables
    useEffect(() => {
        if (!mounted) return
        const root = document.documentElement
        root.style.setProperty("--glass-opacity", glassSettings.opacity.toString())
        root.style.setProperty("--glass-blur", `${glassSettings.blur}px`)
        root.style.setProperty("--glass-border-opacity", glassSettings.borderOpacity.toString())
        root.style.setProperty("--glass-saturation", `${glassSettings.saturation}%`)
        root.style.setProperty("--glass-hover-opacity-add", glassSettings.hoverOpacityAdd.toString())
        root.style.setProperty("--glass-hover-border-add", glassSettings.hoverBorderAdd.toString())
        localStorage.setItem("glass-theme-settings", JSON.stringify(glassSettings))
    }, [glassSettings, mounted])

    const setThemeColor = (color: ThemeColor) => setThemeColorState(color)

    const setGlassPreset = (preset: GlassPreset) => {
        if (preset === "custom") {
            setGlassSettingsState(prev => ({ ...prev, preset: "custom" }))
        } else {
            setGlassSettingsState({ preset, ...GLASS_PRESETS[preset] })
        }
    }

    const setGlassCustomValue = (key: keyof Omit<GlassSettings, "preset">, value: number) => {
        setGlassSettingsState(prev => ({
            ...prev,
            preset: "custom",
            [key]: value
        }))
    }

    const resetGlassToPreset = (preset: Exclude<GlassPreset, "custom">) => {
        setGlassSettingsState({ preset, ...GLASS_PRESETS[preset] })
    }

    const availableColors = Object.entries(themeColorMap).map(([key, colors]) => ({
        key: key as ThemeColor,
        colors
    }))

    return (
        <GlassThemeContext.Provider
            value={{
                themeColor,
                setThemeColor,
                colors: themeColorMap[themeColor],
                availableColors,
                glassSettings,
                setGlassPreset,
                setGlassCustomValue,
                resetGlassToPreset
            }}
        >
            {children}
        </GlassThemeContext.Provider>
    )
}

export function useGlassTheme() {
    const context = useContext(GlassThemeContext)
    if (context === undefined) {
        throw new Error("useGlassTheme must be used within a GlassThemeProvider")
    }
    return context
}
