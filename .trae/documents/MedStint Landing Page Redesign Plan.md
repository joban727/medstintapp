## Scope
- Redesign the main marketing landing page and the global navbar for all devices with a minimalist, modern aesthetic.

## Current Analysis
- Landing composition: `src/app/(marketing)/page.tsx:32–41` renders multiple dense sections that dilute focus.
- Navbar: `src/components/layout/navbar.tsx:22–190` includes gradients, heavy borders, sheet with marketing content; actions vary for signed-in/out.
- Footer density and gradients risk contrast issues; missing `og.jpg` (`src/config/site.ts:8`) breaks social cards.

## Problems To Solve
- Visual clutter and low hierarchy in the hero; two-column layout conflicts with the requested single-column flow.
- Sign-in is not a primary on-page action; CTA path is indirect.
- Navbar and mobile sheet add content noise and animation overhead.
- Accessibility contrast risks (`text-slate-300` on dark gradients) and motion from mouse tracking.

## Redesign Objectives
- Minimalist single-column landing flow with strong white space and clear hierarchy.
- Limited palette: primary blue, neutrals, one accent green using existing CSS variables.
- Sign-in prominence with a clear, immediate path from headline → value → action.
- Modern, lightweight navbar with consistent behavior on mobile/desktop.
- WCAG AA compliance and <2s load time on typical 4G.

## Visual Design System
- Colors: `--primary` (blue), `--background`/`--foreground`, `--accent` (green). Avoid section-wide gradients.
- Typography: System sans (`--font-sans`); desktop heading `text-4xl`, mobile `text-3xl`; body `text-base`.
- Spacing: 8pt scale, sections with `py-16`, content `max-w-xl`.

## Navbar Redesign (All Devices)
- Structure: `nav` with left logo, right-side actions; no center content.
- Desktop:
  - Height `h-16`, container `max-w-7xl px-4`.
  - Background `bg-background/70` with `backdrop-blur-md`; subtle `border` only on focus/hover; remove gradient text in brand.
  - Actions: `Sign In` (primary outline), `Get Started` (solid primary). When signed-in: `Dashboard` + `UserButton`.
- Mobile:
  - Height `h-14`, minimalist hamburger opens a clean sheet with just actions and essential links.
  - Remove marketing tiles inside the sheet to reduce noise; keep clear labels; maintain accessible `aria-*`.
- Accessibility:
  - Ensure `aria-label` on toggles, `aria-expanded` state, focus-visible rings.
- Performance:
  - Limit icon usage to 1–2; tree-shake; reduce borders and shadows; no animated elements in navbar.

## Landing Page Redesign
- Single-column sections: `Hero` → `Three Value Props` → `SignIn Callout` → `Trusted/Compliance Note` → `Footer Lite`.
- Content limits: One headline, one subhead, exactly three value bullets.
- CTA path: Primary `Sign In`, secondary `Create Account`; both are above the fold.
- Remove animated background, floating cards, badge clusters, and tabbed features from the landing.

## Accessibility & Performance
- Contrast: Replace `text-slate-300` on dark backgrounds with higher contrast tokens; verify AA.
- Motion: Remove mouse-follow and pulse animation in hero; respect `prefers-reduced-motion` globally.
- Assets: Add valid `public/og.jpg` (~1200×630, <150KB). Limit `next/image` usage to brand logo above the fold.
- Bundle/DOM: Reduce icon imports and DOM nodes; target <250 nodes and <200KB critical path.

## Implementation Outline
- Update `src/app/(marketing)/page.tsx:32–41` to render the simplified single-column components.
- Refactor `src/components/layout/navbar.tsx:22–190` to the minimalist structure with accessible toggles and reduced visual weight.
- Simplify footer to improve contrast and reduce link density.
- Keep existing design tokens from `src/styles/globals.css:5–121` and map Tailwind to them.
- Add `public/og.jpg` to satisfy metadata in `page.tsx:9–30`.

## Deliverables
- High-fidelity mockups (desktop 1440px, mobile 375px) for landing and navbar.
- Style guide (colors, type scale, spacing, components, focus states).
- Annotated specs for dev handoff (sizes, spacing, states, accessibility notes).
- Performance optimization plan with budgets and Lighthouse targets.

## Measurement Plan
- Track: CTA clicks, sign-in start/completion, scroll depth; collect FCP/LCP/CLS/TBT.
- Targets: -30% bounce, +25% sign-in conversions, CSAT 4.5/5, -15% load time.

Please confirm to proceed. After approval, I will produce mockups, the style guide, annotated specs, and implement the navbar and landing redesign across devices.