## Scope
- Enhance the minimalist landing page with a modern hero that uses Framer Motion for subtle, performant animations.
- Keep the single-column, minimalist aesthetic and accessibility/performance standards intact.

## Motion Approach
- Use existing dynamic motion wrappers from `src/components/ui/motion.tsx` to avoid SSR issues.
- Animations:
  - Hero entrance: fade-in + slight upward slide for headline and subhead.
  - Staggered value props: short fade/slide with small delays.
  - CTA microinteractions: scale/shine on hover, gentle press on tap.
  - Optional decorative figure: low-opacity, small parallax-style shift on viewport enter (no continuous mouse tracking).
- Reduced motion:
  - Respect `prefers-reduced-motion`: disable transitions or reduce duration/translate to near-zero.

## Accessibility & Performance
- Maintain AA contrast; keep animations subtle and non-distracting.
- Limit icons and motion layers to minimal counts to keep LCP fast.
- No continuous event listeners; only viewport-based animations.
- Keep DOM footprint small; avoid heavy gradients/filters.

## Implementation Plan
- Update `src/components/landing/hero-minimal.tsx` to integrate motion wrappers for headline, subhead, and CTA group.
- Update `src/components/landing/value-props.tsx` to use staggered motion for the three list items.
- Add optional lightweight decorative `figure` with motion to the hero, gated behind reduced-motion checks.
- Wire `AnimatePresence` where appropriate for controlled mounts/unmounts; avoid overuse.
- Ensure styles continue to use `globals.css` tokens and Tailwind utilities.

## Deliverables
- Animated hero and value props using Framer Motion.
- Reduced-motion compliance and accessible focus states retained.
- Verified local build and UX.

## Verification
- Run locally, confirm entrance animations, hover/tap microinteractions, and reduced-motion behavior.
- Quick Lighthouse pass for LCP/TBT and visual stability.

If approved, I will implement the motion-enhanced hero and value props using the existing motion utilities and verify behavior end-to-end.