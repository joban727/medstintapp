"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useTheme as useNextTheme } from "next-themes"

// Enhanced theme configuration interface
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system'
  colorScheme: 'medical' | 'professional' | 'accessible'
  animations: 'full' | 'reduced' | 'none'
  density: 'compact' | 'comfortable' | 'spacious'
  contrast: 'normal' | 'high'
  fontSize: 'small' | 'medium' | 'large'
}

// Theme context interface
interface ThemeContextType {
  config: ThemeConfig
  updateConfig: (updates: Partial<ThemeConfig>) => void
  resetToDefaults: () => void
  isLoading: boolean
  applyTheme: (config: ThemeConfig) => void
}

// Default theme configuration
const defaultThemeConfig: ThemeConfig = {
  mode: 'system',
  colorScheme: 'medical',
  animations: 'full',
  density: 'comfortable',
  contrast: 'normal',
  fontSize: 'medium'
}

// Theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Local storage key
const THEME_CONFIG_KEY = 'medstint-theme-config'

// Theme provider component
export function EnhancedThemeProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, systemTheme } = useNextTheme()
  const [config, setConfig] = useState<ThemeConfig>(defaultThemeConfig)
  const [isLoading, setIsLoading] = useState(true)

  // Load theme configuration from localStorage on mount
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(THEME_CONFIG_KEY)
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig) as ThemeConfig
        setConfig({ ...defaultThemeConfig, ...parsedConfig })
      }
    } catch (error) {
      console.warn('Failed to load theme configuration:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Apply theme configuration to document
  const applyTheme = (themeConfig: ThemeConfig) => {
    const root = document.documentElement
    
    // Apply theme mode
    if (themeConfig.mode !== 'system') {
      setTheme(themeConfig.mode)
    } else {
      setTheme('system')
    }

    // Apply color scheme
    root.setAttribute('data-color-scheme', themeConfig.colorScheme)
    
    // Apply animation preferences
    root.setAttribute('data-animations', themeConfig.animations)
    if (themeConfig.animations === 'none' || themeConfig.animations === 'reduced') {
      root.style.setProperty('--animation-duration', '0ms')
      root.style.setProperty('--transition-duration', '0ms')
    } else {
      root.style.removeProperty('--animation-duration')
      root.style.removeProperty('--transition-duration')
    }

    // Apply density
    root.setAttribute('data-density', themeConfig.density)
    switch (themeConfig.density) {
      case 'compact':
        root.style.setProperty('--spacing-multiplier', '0.75')
        root.style.setProperty('--component-padding', '0.5rem')
        break
      case 'spacious':
        root.style.setProperty('--spacing-multiplier', '1.25')
        root.style.setProperty('--component-padding', '1.5rem')
        break
      default:
        root.style.setProperty('--spacing-multiplier', '1')
        root.style.setProperty('--component-padding', '1rem')
    }

    // Apply contrast
    root.setAttribute('data-contrast', themeConfig.contrast)
    if (themeConfig.contrast === 'high') {
      root.style.setProperty('--border-width', '2px')
      root.style.setProperty('--focus-ring-width', '3px')
    } else {
      root.style.setProperty('--border-width', '1px')
      root.style.setProperty('--focus-ring-width', '2px')
    }

    // Apply font size
    root.setAttribute('data-font-size', themeConfig.fontSize)
    switch (themeConfig.fontSize) {
      case 'small':
        root.style.setProperty('--base-font-size', '14px')
        break
      case 'large':
        root.style.setProperty('--base-font-size', '18px')
        break
      default:
        root.style.setProperty('--base-font-size', '16px')
    }

    // Apply medical theme specific styles
    if (themeConfig.colorScheme === 'medical') {
      root.style.setProperty('--primary', 'var(--medical-primary)')
      root.style.setProperty('--accent', 'var(--healthcare-green)')
    } else if (themeConfig.colorScheme === 'professional') {
      root.style.setProperty('--primary', 'var(--professional-gray-dark)')
      root.style.setProperty('--accent', 'var(--medical-teal)')
    }
  }

  // Update theme configuration
  const updateConfig = (updates: Partial<ThemeConfig>) => {
    const newConfig = { ...config, ...updates }
    setConfig(newConfig)
    
    // Save to localStorage
    try {
      localStorage.setItem(THEME_CONFIG_KEY, JSON.stringify(newConfig))
    } catch (error) {
      console.warn('Failed to save theme configuration:', error)
    }
    
    // Apply theme immediately
    applyTheme(newConfig)
  }

  // Reset to default configuration
  const resetToDefaults = () => {
    setConfig(defaultThemeConfig)
    try {
      localStorage.removeItem(THEME_CONFIG_KEY)
    } catch (error) {
      console.warn('Failed to clear theme configuration:', error)
    }
    applyTheme(defaultThemeConfig)
  }

  // Apply theme when config changes
  useEffect(() => {
    if (!isLoading) {
      applyTheme(config)
    }
  }, [config, isLoading])

  // Handle system theme changes
  useEffect(() => {
    if (config.mode === 'system' && systemTheme) {
      applyTheme(config)
    }
  }, [systemTheme, config])

  // Handle reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && config.animations === 'full') {
        updateConfig({ animations: 'reduced' })
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    
    // Check initial state
    if (mediaQuery.matches && config.animations === 'full') {
      updateConfig({ animations: 'reduced' })
    }

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [config.animations])

  // Handle high contrast preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches && config.contrast === 'normal') {
        updateConfig({ contrast: 'high' })
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    
    // Check initial state
    if (mediaQuery.matches && config.contrast === 'normal') {
      updateConfig({ contrast: 'high' })
    }

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [config.contrast])

  const contextValue: ThemeContextType = {
    config,
    updateConfig,
    resetToDefaults,
    isLoading,
    applyTheme
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  )
}

// Custom hook to use theme context
export function useEnhancedTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useEnhancedTheme must be used within an EnhancedThemeProvider')
  }
  return context
}

// Utility function to get theme-aware classes
export function getThemeClasses(baseClasses: string, themeVariants?: {
  light?: string
  dark?: string
  medical?: string
  professional?: string
  accessible?: string
}) {
  if (!themeVariants) return baseClasses
  
  const variants = []
  
  if (themeVariants.light) {
    variants.push(`light:${themeVariants.light}`)
  }
  
  if (themeVariants.dark) {
    variants.push(`dark:${themeVariants.dark}`)
  }
  
  if (themeVariants.medical) {
    variants.push(`[data-color-scheme="medical"]:${themeVariants.medical}`)
  }
  
  if (themeVariants.professional) {
    variants.push(`[data-color-scheme="professional"]:${themeVariants.professional}`)
  }
  
  if (themeVariants.accessible) {
    variants.push(`[data-color-scheme="accessible"]:${themeVariants.accessible}`)
  }
  
  return `${baseClasses} ${variants.join(' ')}`
}

// Theme-aware component wrapper
export function ThemeAware({ 
  children, 
  className = "",
  themeClasses 
}: { 
  children: ReactNode
  className?: string
  themeClasses?: {
    light?: string
    dark?: string
    medical?: string
    professional?: string
    accessible?: string
  }
}) {
  const enhancedClasses = getThemeClasses(className, themeClasses)
  
  return (
    <div className={enhancedClasses}>
      {children}
    </div>
  )
}