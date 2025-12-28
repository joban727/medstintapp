## Overview
- Build a Todo app inside the existing Next.js 15 React TS project using Tailwind v4 and Shadcn UI components.
- Persist with localStorage by default, with an optional API adapter to swap later without UI changes.
- Provide filters, accessibility, validation, error handling, tests, and minimal themed styling matching current design.

## Architecture
- **Pages**: `src/app/todos/page.tsx` (client component) renders the feature.
- **State**: `src/stores/todo-store.ts` using Zustand + `persist` (pattern consistent with `src/stores/onboarding-store.ts`).
- **Types**: `src/types/todos.ts` for `Todo`, `TodoFilter`.
- **Persistence**: `src/lib/todos/storage.ts` defines a `TodoStorage` interface with two adapters:
  - `LocalStorageTodoStorage` (default)
  - `ApiTodoStorage` (optional, via fetch to `/api/todos`)
- **UI Components**: `src/components/todos/` for small, reusable units:
  - `TodoInput.tsx` (add new item)
  - `TodoList.tsx` (list + checkbox + delete)
  - `TodoFilters.tsx` (All/Active/Completed)
  - `TodoItem.tsx` (single row)
- **API (optional)**: `src/app/api/todos/route.ts` (CRUD stub) if you want server persistence later.

## State & Persistence
- **Zustand store**: actions `add`, `updateTitle`, `toggleComplete`, `remove`, `clearCompleted`, `setFilter`, `hydrateFromStorage`.
- **Persist**: `persist(createJSONStorage(() => localStorage))` mirroring `src/stores/onboarding-store.ts:480-495`.
- **Pluggable storage**: store calls `storage.list/create/update/delete` so swapping to API is trivial.

## Validation
- Use `zod` for input validation: trim, non-empty, max length (e.g., 200 chars).
- Prevent duplicates by case-insensitive compare; surface inline errors.

## Accessibility
- Keyboard: Enter to add, Space to toggle, Delete to remove focused item; Tab order maintained.
- ARIA: `aria-label` for inputs/buttons, `role="list"` and `role="listitem"`, `aria-live="polite"` for add/remove announcements.
- Focus management: move focus back to input after add; visible focus rings via existing theme.

## UI & Styling
- Use existing Shadcn UI: `@/components/ui/input`, `button`, `checkbox`, `tabs`, `card`.
- Responsive layout: stacked on mobile, two-column spacing on desktop.
- Themed using `src/styles/globals.css` tokens; no custom framework changes.

## Error Handling
- LocalStorage read/write guarded; fallback to in-memory if unavailable.
- Adapter-level errors surfaced via toast or inline error banner; log with `console.warn` (no secrets).

## Tests
- **Store tests**: `src/tests/stores/todo-store.test.ts` with Vitest.
  - add/update/toggle/remove/filters/persist hydration.
- **Component tests**: `src/tests/components/todos.test.tsx` using Testing Library.
  - add via keyboard, toggle via checkbox, delete button, filter behavior, ARIA roles and labels.

## Documentation
- Update or create `README.md` section "Todo App" with setup, dev, test commands, and architecture notes.
- Brief comments inside store/types only when necessary (kept minimal).

## Implementation Plan
### Phase 1: Types & Storage Abstraction
- Add `src/types/todos.ts` and `src/lib/todos/storage.ts` with interface + localStorage adapter.

### Phase 2: Zustand Store
- Implement `src/stores/todo-store.ts` with actions, filters, and `persist`.

### Phase 3: UI Components
- Create `src/components/todos/{TodoInput,TodoItem,TodoList,TodoFilters}.tsx` using Shadcn UI.
- Wire ARIA labels, keyboard handlers, and responsive classes.

### Phase 4: Page Integration
- Add `src/app/todos/page.tsx` (client) composing components, reading store, showing counts and filter tabs.

### Phase 5: Optional API Adapter
- Add `ApiTodoStorage` and `src/app/api/todos/route.ts` (CRUD stub); keep behind a simple config flag.

### Phase 6: Tests
- Write Vitest tests for store and components; ensure coverage of core flows and a11y roles.

### Phase 7: Documentation
- Add README section with setup, run, test, and design overview.

## Deliverables
- Functional Todo app at `/todos` with create/read/update/delete, complete/incomplete, filters.
- LocalStorage persistence; easy swap to API.
- Unit tests for store and components.
- Basic styling consistent with current theme and components.
- README updates with setup and architecture.

## Notes on Conventions
- Align with existing patterns seen in `src/stores/onboarding-store.ts` and `src/components/ui/*`.
- Keep client components prefixed with `"use client"` under `app/`.
- No secrets; no changes to global config.

Would you like me to proceed with this plan?