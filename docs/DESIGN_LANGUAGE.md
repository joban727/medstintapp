# MedStint Design Language

> A Steve Jobs-inspired design system emphasizing clarity, simplicity, and premium aesthetics.

---

## Core Philosophy

1. **Monochrome Typography** – Text is always black/white. Never use colorful fonts.
2. **Color from Environment** – Color comes from subtle backgrounds, gradients, and accents—not text.
3. **Generous Whitespace** – Let elements breathe. Crowded UI is never premium.
4. **Subtle Motion** – Animations should feel natural, not flashy. Use easing curves.
5. **Hierarchy Through Weight** – Use font weight contrast (bold vs light) instead of size differences.

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
```

### Hierarchy
| Level | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| Hero H1 | `text-4xl` to `text-7xl` | `font-bold` | `tracking-tight` | Landing page headlines |
| H1 | `text-3xl` | `font-bold` | `tracking-tight` | Page titles |
| H2 | `text-2xl` | `font-semibold` | `tracking-tight` | Section headers |
| H3 | `text-xl` | `font-medium` | default | Card headers |
| Body | `text-base` | `font-normal` | default | Content |
| Caption | `text-sm` | `font-medium` | default | Labels, metadata |
| Micro | `text-xs` | `font-medium` | default | Pills, badges |

### Weight Contrast Pattern
Use weight contrast to create visual hierarchy without size differences:
```tsx
<span className="font-bold">Med</span>
<span className="font-medium text-foreground/85">Stint</span>
```

---

## Color System

### Base Colors
- **Foreground**: `text-foreground` (Black in light mode, White in dark mode)
- **Muted**: `text-muted-foreground` (Grey for secondary text)
- **Background**: `bg-background` (White in light, Dark grey in dark)

### Opacity Levels
| Level | Opacity | Usage |
|-------|---------|-------|
| Primary | 100% | Headlines, primary actions |
| Secondary | 85% | Secondary text, supporting info |
| Muted | 70% | Tertiary info, disabled states |
| Subtle | 40-50% | Borders, dividers, icons |
| Ghost | 5-10% | Hover states, subtle fills |

### Accent Colors (Use Sparingly)
- **Emerald** (`emerald-500`): Success, positive actions
- **Rose** (`rose-500`): Errors, destructive actions
- **Amber** (`amber-500`): Warnings
- **Violet** (`violet-500`): Highlights, special features

> **Rule**: Colors appear in backgrounds, icons, and status indicators—never in body text.

---

## Spacing

### Scale
```
4px  → gap-1, p-1, m-1
8px  → gap-2, p-2, m-2
12px → gap-3, p-3, m-3
16px → gap-4, p-4, m-4
24px → gap-6, p-6, m-6
32px → gap-8, p-8, m-8
48px → gap-12, p-12, m-12
```

### Guidelines
- **Card padding**: `p-6` (24px)
- **Section gaps**: `gap-8` to `gap-12`
- **Element gaps within cards**: `gap-4` to `gap-6`
- **Inline element gaps**: `gap-2` to `gap-3`

---

## Components

### Buttons

**Primary (Dark on Light, Light on Dark)**
```tsx
className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6 py-3 font-medium"
```

**Secondary (Ghost)**
```tsx
className="bg-foreground/5 hover:bg-foreground/10 border border-foreground/10 rounded-full px-6 py-3 font-medium"
```

**Key Rules**:
- Use `rounded-full` for hero CTAs
- Use `rounded-lg` for dashboard actions
- Always include subtle hover state transitions

### Cards

**Standard Card**
```tsx
className="bg-background border border-foreground/10 rounded-xl p-6 shadow-sm"
```

**Glass Card (for overlays)**
```tsx
className="bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-xl p-6"
```

### Pills/Badges
```tsx
className="px-4 py-2 text-xs font-medium text-foreground/70 bg-foreground/5 rounded-full border border-foreground/10"
```

### Tables
- Header: `bg-foreground/5 font-medium text-foreground/70`
- Rows: Alternate `bg-transparent` and `bg-foreground/[0.02]`
- Borders: `border-foreground/10`

---

## Motion

### Easing
```css
/* Apple-style spring easing */
transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
```

### Hover States
- **Scale**: `hover:scale-[1.02]` (subtle lift)
- **Background**: `hover:bg-foreground/10`
- **Border**: `hover:border-foreground/20`

### Page Transitions
- Fade in: `opacity` 0 → 1, 0.5s
- Slide up: `translateY` 15px → 0, 0.5s

---

## Applying to Dashboards

### Dashboard Layout
```tsx
<div className="min-h-screen bg-background">
  {/* Sidebar */}
  <aside className="fixed left-0 top-0 h-screen w-64 border-r border-foreground/10 bg-background p-6">
    {/* Logo */}
    {/* Navigation */}
  </aside>
  
  {/* Main Content */}
  <main className="ml-64 p-8">
    {/* Page Header */}
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Page Title</h1>
      <p className="text-muted-foreground mt-2">Page description</p>
    </header>
    
    {/* Content Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Cards */}
    </div>
  </main>
</div>
```

### Dashboard Card Pattern
```tsx
<div className="bg-background border border-foreground/10 rounded-xl p-6 hover:border-foreground/20 transition-colors duration-200">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-medium text-foreground">Card Title</h3>
    <span className="text-xs font-medium text-foreground/50">Label</span>
  </div>
  
  <div className="text-4xl font-bold tracking-tight text-foreground mb-2">
    128
  </div>
  
  <p className="text-sm text-muted-foreground">
    +12% from last month
  </p>
</div>
```

### Dashboard Table Pattern
```tsx
<div className="border border-foreground/10 rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="bg-foreground/5">
        <th className="px-4 py-3 text-left text-xs font-medium text-foreground/70 uppercase tracking-wider">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-foreground/10">
      <tr className="hover:bg-foreground/[0.02] transition-colors">
        <td className="px-4 py-4 text-sm text-foreground">
          Cell content
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Sidebar Navigation Pattern
```tsx
<nav className="space-y-1">
  {/* Active Item */}
  <a className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-foreground/10 text-foreground font-medium">
    <Icon className="w-5 h-5" />
    Active Page
  </a>
  
  {/* Inactive Item */}
  <a className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition-colors">
    <Icon className="w-5 h-5" />
    Other Page
  </a>
</nav>
```

### Form Inputs Pattern
```tsx
<input 
  className="w-full px-4 py-3 bg-background border border-foreground/10 rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 transition-all"
  placeholder="Placeholder text"
/>
```

---

## Quick Reference

### Do's ✓
- Use monochrome text (black/white only)
- Apply color through backgrounds and icons
- Use generous padding and margins
- Apply subtle hover states
- Use weight contrast for hierarchy

### Don'ts ✗
- Never use colorful body text
- Never crowd elements together
- Never use harsh shadows
- Never use instant transitions (always ease)
- Never use more than 2 accent colors on one screen

---

## CSS Utilities Available

Import in your component:
```tsx
import '@/styles/apple.css'
```

| Class | Effect |
|-------|--------|
| `.glass-premium` | Frosted glass background |
| `.glass-ultra` | Heavy frosted glass |
| `.shadow-apple` | Subtle layered shadow |
| `.shadow-apple-lg` | Large layered shadow |
| `.hover-lift` | Subtle lift on hover |
| `.divider-apple` | Gradient divider line |
| `.btn-apple-primary` | Primary button style |
| `.btn-apple-secondary` | Secondary button style |

---

*This design language creates a cohesive, premium experience across all MedStint interfaces.*
