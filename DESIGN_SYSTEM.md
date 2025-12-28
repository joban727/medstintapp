# MedStint Design System

A comprehensive guide to the unified design language for the MedStint application.

## Table of Contents

- [Design Tokens](#design-tokens)
- [Core Components](#core-components)
- [Layout Patterns](#layout-patterns)
- [Animation System](#animation-system)
- [Dark Mode Support](#dark-mode-support)

---

## Design Tokens

Design tokens are defined in `src/styles/globals.css` and provide consistent values across the application.

### Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--medical-primary` | `hsl(221.2 83.2% 53.3%)` | `hsl(217.2 91.2% 59.8%)` | Primary actions, links |
| `--healthcare-green` | `hsl(142.1 70.6% 45.3%)` | `hsl(142.1 76.2% 36.3%)` | Success states, health indicators |
| `--error` | `hsl(0 84.2% 60.2%)` | `hsl(0 72.2% 50.6%)` | Error states, alerts |
| `--warning` | `hsl(38 92% 50%)` | `hsl(38 92% 50%)` | Warnings, pending states |

### Typography

```css
--font-sans: Inter, system-ui, sans-serif;
--font-heading: var(--font-sans);
```

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 0.25rem | Tight spacing |
| `space-2` | 0.5rem | Inline elements |
| `space-4` | 1rem | Standard gap |
| `space-6` | 1.5rem | Section spacing |
| `space-8` | 2rem | Large gaps |

---

## Core Components

### PageContainer

Provides consistent page layout with proper padding and max-width constraints.

```tsx
import { PageContainer, PageHeader, PageSection } from "@/components/ui/page-container"

<PageContainer>
  <PageHeader 
    title="Dashboard" 
    description="Welcome back, user"
    action={<Button>New Action</Button>}
  />
  <PageSection title="Statistics">
    {/* Content */}
  </PageSection>
</PageContainer>
```

**Props:**
- `className`: Additional CSS classes
- `children`: Page content

### StatCard & StatGrid

Display key metrics in a consistent format.

```tsx
import { StatCard, StatGrid } from "@/components/ui/stat-card"

<StatGrid>
  <StatCard
    title="Total Students"
    value={150}
    icon={Users}
    variant="blue"
    description="+12% from last month"
    showProgress
    progressValue={75}
    action={{ label: "View All", href: "/students" }}
  />
</StatGrid>
```

**Variants:** `default`, `blue`, `green`, `purple`, `orange`

### DashboardSkeleton

Loading state for dashboard pages.

```tsx
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton"

<Suspense fallback={<DashboardSkeleton />}>
  <DashboardContent />
</Suspense>
```

### QuickActions

Grid of action buttons for common tasks.

```tsx
import { QuickActions } from "@/components/ui/quick-actions"

const actions = [
  { title: "Add Student", description: "Register new student", icon: Plus, href: "/add" }
]

<QuickActions actions={actions} title="Quick Actions" />
```

### ActivityList & TaskList

Lists for activities and pending tasks.

```tsx
import { ActivityList, TaskList } from "@/components/ui/activity-list"

<ActivityList 
  activities={[
    { id: "1", message: "New student enrolled", time: "2 hours ago", type: "info" }
  ]}
/>

<TaskList tasks={tasks} onActionClick={handleAction} />
```

---

## Layout Patterns

### Dashboard Grid

Use CSS Grid for dashboard layouts:

```tsx
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
  {/* Stat cards */}
</div>
```

### Card Styling

Apply consistent card classes:

```tsx
<Card className="glass-card card-hover-lift rounded-xl">
  {/* Content */}
</Card>
```

**Available Classes:**
- `glass-card` - Glassmorphism effect with backdrop blur
- `glass-card-subtle` - Lighter glassmorphism
- `card-hover-lift` - Lift animation on hover
- `spotlight-card` - Interactive spotlight effect

### Icon Containers

Consistent icon styling:

```tsx
<div className="icon-container icon-container-blue">
  <UserIcon className="h-5 w-5" />
</div>
```

**Variants:** `icon-container-blue`, `icon-container-green`, `icon-container-purple`, `icon-container-orange`

---

## Animation System

Defined in `src/styles/custom.css`:

### Stagger Animation

```tsx
<div className="stagger-children">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

### Stat Value Animation

```tsx
<div className="animate-stat-value">1,234</div>
```

### Reduced Motion

All animations respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-stat-value,
  .stagger-children > * {
    animation: none;
  }
}
```

---

## Dark Mode Support

The application uses CSS custom properties for seamless dark mode:

```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... other tokens */
}
```

### Testing Dark Mode

Toggle dark mode in browser DevTools:
1. Open DevTools → Elements
2. Add `class="dark"` to `<html>` element

---

## Best Practices

1. **Always use design tokens** - Never hardcode colors or spacing
2. **Use PageContainer** - Wrap all dashboard/page content
3. **Apply glass-card classes** - Consistent card appearance
4. **Include stagger-children** - For lists and grids
5. **Test dark mode** - Verify all components work in both modes
6. **Respect reduced motion** - Animations should be subtle

---

## File Structure

```
src/
├── components/ui/
│   ├── page-container.tsx    # PageContainer, PageHeader, PageSection
│   ├── stat-card.tsx         # StatCard, StatGrid
│   ├── dashboard-skeleton.tsx # DashboardSkeleton
│   ├── quick-actions.tsx      # QuickActions
│   └── activity-list.tsx      # ActivityList, TaskList
├── styles/
│   ├── globals.css           # Design tokens, base styles
│   └── custom.css            # Animations, effects
```
