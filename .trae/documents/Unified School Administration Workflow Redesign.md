## Objectives
- Reduce navigation complexity to a dashboard-style interface where all critical tasks are reachable within 2 clicks.
- Integrate Programs, Rotations, Time Logs, and Clinical Sites into a single synchronized workspace.
- Maintain role-based access control, audit trails, comprehensive reporting, and mobile responsiveness.
- Instrument and validate click reductions with administrator user testing.

## Current Baseline (Repo Observations)
- App shell and dashboard: `src/components/layout/dashboard-layout-client.tsx:51` renders the sidebar/breadcrumb shell.
- RBAC and auditing: `src/lib/rbac-middleware.ts:607` (API auth), `src/lib/rbac-middleware.ts:526` (audit logging), `src/lib/rbac-middleware.ts:34` (protected routes).
- Programs: `src/app/dashboard/school-admin/programs/page.tsx:6` and client `src/components/dashboard/programs-client.tsx:67` (table management + modal creation).
- Rotations: `src/app/dashboard/school-admin/rotations/page.tsx:7` and client `src/components/dashboard/school-rotations-client.tsx:73` (list/table, no timeline or drag-and-drop yet).
- Time records: `src/app/dashboard/student/time-records/page.tsx:3`, `src/components/student/time-records-history.tsx:35` (history + simple filters).
- Clinical sites: `src/app/dashboard/school-admin/sites/page.tsx:51` (directory, capacity visibility via rotation counts).
- Real-time sync primitives: `src/hooks/use-time-sync.ts:45` (SSE fallback long-poll), `src/lib/time-sync-service.ts:71` (service abstraction).
- Reporting: `src/components/reporting/comprehensive-reports-dashboard.tsx:131` (rich reporting UI with export/schedule).

## Unified Dashboard Workspace
- Replace scattered pages with a single "School Admin Control Center" at `"/dashboard/school-admin"` featuring:
  - Left: Role-aware sidebar with quick actions and section anchors (Programs, Rotations, Time, Sites).
  - Center: Multi-tab workspace with 4 integrated panels:
    - "Schedule" timeline (primary), "Programs", "Sites", "Time & Attendance".
  - Right: Context panel that shows selected entity (program/rotation/site/student) details and inline actions.
- Two-click principle:
  - Global command palette and quick actions in header.
  - Inline modals/side-panels for edit/create to avoid full page navigation.
  - Cross-linked entities (click rotation → opens time logs, site capacity, program requirements in-context).

## Program Management Integration
- Centralized grid with program cards; inline create/modify; requirement editor and completion status.
- Display requirement progress per student cohort; show completion badges.
- Link program → rotations: filter timeline by program to view assigned rotations and capacity.
- Reuse existing program endpoints; keep RBAC gates client-side and server-side (`src/lib/rbac-middleware.ts:34`).

## Rotation Scheduling (Timeline + Drag-and-Drop)
- Implement a visual timeline (week/month views) with drag-and-drop for student assignments.
- Conflict detection:
  - Overlapping student rotations, site capacity, preceptor availability, and time log overlaps.
  - Real-time alerts and auto-fix suggestions.
- Inline actions: create rotation, assign students, swap sites/preceptors.
- Technical notes:
  - Add a drag-and-drop library (e.g., `dnd-kit`) for timeline interactions.
  - Server validation routes gated by `apiAuthMiddleware` (`src/lib/rbac-middleware.ts:607`).

## Student Time Logs Integration
- Overlay time logs onto rotation timeline (aligned bars per student).
- Automated attendance:
  - Clock-in/out buttons tied to schedule blocks; geofence checks against site location.
  - Use synchronized timestamps via time sync hook (`src/hooks/use-time-sync.ts:363` get corrected timestamp).
- Real-time hours monitoring aggregated by rotation/program/site with alerts for under/over-hour conditions.

## Clinical Site Management Integration
- Unified site directory with capacity indicators and real-time availability (current active rotations).
- Site-specific requirements and document checklist panel; link to rotations using the site.
- Capacity planning:
  - When scheduling, show live capacity and conflicts.
  - Inline request to increase capacity or reassign.

## Real-Time Synchronization
- Adopt existing SSE time sync (`src/hooks/use-time-sync.ts:256`) and service (`src/lib/time-sync-service.ts:148`).
- Add domain event channels (SSE endpoints) for schedule changes, time logs, and site capacity updates for immediate UI sync.
- Client state: light global store via Zustand for workspace selections; optimistic updates with server reconciliation.

## Role-Based Access Controls
- Continue to enforce server-side guards (`apiAuthMiddleware` at `src/lib/rbac-middleware.ts:607`).
- Client-side gating of UI actions and visibility based on roles/permissions derived from `PROTECTED_ROUTES` (`src/lib/rbac-middleware.ts:34`).
- Context panel shows only permitted actions and fields for current role.

## Reporting
- Keep comprehensive dashboards (`src/components/reporting/comprehensive-reports-dashboard.tsx:276`) accessible from a top-level tab.
- Add quick exports and scheduled reports directly from selected program/site/rotation context.
- Cross-filters auto-populate when triggered from the workspace selection.

## Mobile Responsiveness
- Responsive timeline: collapse to stacked list with tap-to-edit and swipe actions.
- Preserve quick actions and context panel as bottom sheets on mobile.
- Tailwind utility-driven responsive design aligned with current style.

## Audit Trails
- Log all create/update/delete events through `logAuditEvent` (`src/lib/rbac-middleware.ts:526`).
- Include context (programId/rotationId/siteId/studentId) and before/after diffs for audits.
- Expose audit feed in the workspace context panel for the current entity.

## Click-Reduction Strategy
- Instrument click telemetry at the workspace level:
  - Capture click paths for common tasks (create program, schedule rotation, assign student, clock-in/out, upload site doc).
  - Aggregate and compare before/after average clicks per task.
- UI Guardrails:
  - Quick action buttons and inline editors reduce navigation.
  - Deep-linkable workspace states to share exact views (program + rotation filter).

## User Testing & Validation
- Recruit 6–10 administrators; define scenarios:
  - Create program with requirements; assign cohort.
  - Plan rotation schedule; resolve conflicts.
  - Monitor and adjust student time logs; approve attendance.
  - Manage clinical site capacity; attach required docs.
- Methodology:
  - Baseline test in current UI (record clicks/time).
  - Test redesigned workspace; collect telemetry and subjective ratings.
  - Target: ≥40% reduction in clicks per task; ≥25% reduction in time-on-task.
- Reporting:
  - Produce a test report with quantitative metrics and qualitative feedback.

## Deliverables
- Unified control-center workspace with integrated panels.
- Timeline scheduler with drag-and-drop and conflict resolution.
- Time log overlay and automated attendance.
- Site capacity indicators and requirements panel.
- Real-time sync event channels; Zustand store.
- RBAC-gated actions and audit feeds.
- Click telemetry and user testing report with measured reductions.

## Phased Implementation
1. Workspace shell and panels (reuse `dashboard-layout-client.tsx`).
2. Timeline scheduler and drag/drop.
3. Time log overlay and attendance integration.
4. Site capacity, requirements, and document management.
5. Real-time events and optimistic sync.
6. RBAC hardening and audit wiring.
7. Telemetry instrumentation and administrator testing.

Please review and confirm; on approval, I will implement this plan and validate outcomes with testing and measured click reductions.