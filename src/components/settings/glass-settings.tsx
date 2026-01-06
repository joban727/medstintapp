"use client"

import { cn } from "@/lib/utils"
import { useTheme, GlassPreset, GLASS_PRESETS } from "@/contexts/theme-context"
import { Slider } from "@/components/ui/slider"

const PRESETS: { id: GlassPreset; name: string; description: string }[] = [
  { id: "off", name: "Off", description: "No glass effect" },
  { id: "subtle", name: "Subtle", description: "Light blur, subtle borders" },
  { id: "normal", name: "Normal", description: "Balanced glass look" },
  { id: "strong", name: "Strong", description: "Heavy blur, prominent effect" },
]

interface GlassSettingsProps {
  className?: string
  showCustom?: boolean
}

export function GlassSettings({ className, showCustom = true }: GlassSettingsProps) {
  const { glassSettings, setGlassPreset, setCustomGlassSettings } = useTheme()

  return (
    <div className={cn("space-y-6", className)}>
      {/* Preset Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Glass Effect</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setGlassPreset(preset.id)}
              className={cn(
                "glass-button px-4 py-3 rounded-xl text-left transition-all",
                glassSettings.preset === preset.id && "ring-2 ring-white/30"
              )}
            >
              <div className="text-sm font-medium">{preset.name}</div>
              <div className="text-xs text-muted-foreground">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Sliders */}
      {showCustom && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Custom Settings</label>
            <span className="text-xs text-muted-foreground">
              {glassSettings.preset === "custom"
                ? "Custom"
                : PRESETS.find((p) => p.id === glassSettings.preset)?.name}
            </span>
          </div>

          {/* Opacity */}
          <Slider
            label="Opacity"
            value={glassSettings.opacity * 100}
            onChange={(v) => setCustomGlassSettings({ opacity: v / 100 })}
            min={0}
            max={20}
            step={1}
            valueLabel={`${(glassSettings.opacity * 100).toFixed(0)}%`}
          />

          {/* Blur */}
          <Slider
            label="Blur"
            value={glassSettings.blur}
            onChange={(v) => setCustomGlassSettings({ blur: v })}
            min={0}
            max={40}
            step={2}
            valueLabel={`${glassSettings.blur}px`}
          />

          {/* Saturation */}
          <Slider
            label="Saturation"
            value={glassSettings.saturation}
            onChange={(v) => setCustomGlassSettings({ saturation: v })}
            min={100}
            max={200}
            step={10}
            valueLabel={`${glassSettings.saturation}%`}
          />

          {/* Border Opacity */}
          <Slider
            label="Border"
            value={glassSettings.borderOpacity * 100}
            onChange={(v) => setCustomGlassSettings({ borderOpacity: v / 100 })}
            min={0}
            max={30}
            step={1}
            valueLabel={`${(glassSettings.borderOpacity * 100).toFixed(0)}%`}
          />
        </div>
      )}
    </div>
  )
}
