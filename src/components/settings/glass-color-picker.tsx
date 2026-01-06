"use client"

import { cn } from "@/lib/utils"
import { useTheme, ThemeColor } from "@/contexts/theme-context"

const THEME_COLORS: { id: ThemeColor; name: string; gradient: string }[] = [
  { id: "slate", name: "Slate", gradient: "from-[#94a2b4] to-[#7a8a9e]" },
  { id: "orange", name: "Peach", gradient: "from-[#d99869] to-[#c78555]" },
  { id: "indigo", name: "Lavender", gradient: "from-[#9699c8] to-[#8385ba]" },
  { id: "purple", name: "Lilac", gradient: "from-[#af96c8] to-[#9880b0]" },
  { id: "emerald", name: "Sage", gradient: "from-[#75a894] to-[#5d9580]" },
  { id: "rose", name: "Rose", gradient: "from-[#c88c96] to-[#b57882]" },
  { id: "amber", name: "Gold", gradient: "from-[#c3af78] to-[#b09c65]" },
  { id: "blue", name: "Sky", gradient: "from-[#82a5c8] to-[#6a90b5]" },
]

interface GlassColorPickerProps {
  className?: string
  showLabel?: boolean
}

export function GlassColorPicker({ className, showLabel = true }: GlassColorPickerProps) {
  const { themeColor, setThemeColor } = useTheme()

  return (
    <div className={cn("space-y-3", className)}>
      {showLabel && <label className="text-sm font-medium text-foreground">Theme Color</label>}
      <div className="grid grid-cols-4 gap-2">
        {THEME_COLORS.map((color) => (
          <button
            key={color.id}
            onClick={() => setThemeColor(color.id)}
            className={cn(
              "w-full aspect-square rounded-lg bg-gradient-to-br",
              color.gradient,
              "transition-all duration-200 hover:scale-105",
              "border-2",
              themeColor === color.id
                ? "border-white ring-2 ring-white/30"
                : "border-transparent hover:border-white/30"
            )}
            title={color.name}
          />
        ))}
      </div>
    </div>
  )
}
