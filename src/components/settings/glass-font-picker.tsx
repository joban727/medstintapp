"use client"

import { cn } from "@/lib/utils"
import { useTheme, ThemeFont } from "@/contexts/theme-context"

const FONTS: { id: ThemeFont; name: string; style: string }[] = [
  { id: "inter", name: "Inter", style: "font-sans" },
  { id: "manrope", name: "Manrope", style: "font-manrope" },
  { id: "outfit", name: "Outfit", style: "font-outfit" },
  { id: "roboto", name: "Roboto", style: "font-roboto" },
]

interface GlassFontPickerProps {
  className?: string
}

export function GlassFontPicker({ className }: GlassFontPickerProps) {
  const { themeFont, setThemeFont } = useTheme()

  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {FONTS.map((font) => (
        <button
          key={font.id}
          onClick={() => setThemeFont(font.id)}
          className={cn(
            "glass-button px-4 py-3 rounded-xl text-left transition-all",
            themeFont === font.id && "ring-2 ring-white/30 bg-white/10"
          )}
        >
          <div className="text-sm font-medium text-white">{font.name}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">The quick brown fox</div>
        </button>
      ))}
    </div>
  )
}
