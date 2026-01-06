# Frontend Design Rules

> Based on Anthropic's claude-code frontend-design skill. Use these rules for all UI work.

---

## Core Principles

Create **distinctive, production-grade frontend interfaces** that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

---

## Design Thinking (Before Coding)

1. **Purpose**: What problem does this interface solve? Who uses it?
2. **Tone**: Pick an extreme direction:
   - Brutally minimal
   - Maximalist chaos
   - Retro-futuristic
   - Organic/natural
   - Luxury/refined
   - Playful/toy-like
   - Editorial/magazine
   - Brutalist/raw
   - Art deco/geometric
   - Soft/pastel
   - Industrial/utilitarian
3. **Constraints**: Technical requirements (framework, performance, accessibility)
4. **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

> **CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

---

## Aesthetic Guidelines

### 1. Typography
- Choose fonts that are **beautiful, unique, and interesting**
- ❌ AVOID generic fonts: Arial, Inter, Roboto, system fonts
- ✅ Use distinctive choices that elevate aesthetics
- Pair a **distinctive display font** with a **refined body font**
- Unexpected, characterful font choices

### 2. Color & Theme
- Commit to a **cohesive aesthetic**
- Use CSS variables for consistency
- **Dominant colors with sharp accents** outperform timid, evenly-distributed palettes
- ❌ AVOID cliched color schemes (particularly purple gradients on white backgrounds)

### 3. Motion
- Use animations for effects and **micro-interactions**
- Focus on **high-impact moments**:
  - One well-orchestrated page load with **staggered reveals** (animation-delay)
  - Creates more delight than scattered micro-interactions
- Use **scroll-triggering** and **hover states that surprise**
- Prioritize CSS-only solutions for HTML
- Use Motion library for React when available

### 4. Spatial Composition
- **Unexpected layouts**
- Asymmetry
- Overlap
- Diagonal flow
- Grid-breaking elements
- **Generous negative space** OR **controlled density**

### 5. Backgrounds & Visual Details
- Create **atmosphere and depth** (not solid colors)
- Add contextual effects that match the aesthetic:
  - Gradient meshes
  - Noise textures
  - Geometric patterns
  - Layered transparencies
  - Dramatic shadows
  - Decorative borders
  - Custom cursors
  - Grain overlays

---

## NEVER Use (Generic AI Aesthetics)

❌ Overused font families: Inter, Roboto, Arial, system fonts
❌ Cliched color schemes (purple gradients on white)
❌ Predictable layouts and component patterns
❌ Cookie-cutter design lacking context-specific character
❌ Space Grotesk and other commonly converged-upon choices

---

## Match Complexity to Vision

- **Maximalist designs**: Need elaborate code with extensive animations and effects
- **Minimalist/refined designs**: Need restraint, precision, careful attention to spacing, typography, and subtle details
- **Elegance** comes from executing the vision well

---

## For MedStint: Chosen Direction

**Tone**: **Luxury/Refined Medical** with **Editorial/Magazine** influences

**Differentiator**: A clinical education platform that feels like a premium medical journal meets Apple product page

**Key Elements**:
1. **Typography**: Distinctive serif for headlines + refined sans for body
2. **Motion**: Orchestrated page load reveals, subtle parallax, scroll-triggered animations
3. **Color**: Near-monochrome with strategic medical emerald/teal accents
4. **Composition**: Generous whitespace, asymmetric hero layouts
5. **Atmosphere**: Subtle gradient meshes, grain textures, glowing accents

---

*Interpret creatively. Make unexpected choices. No design should be the same.*
