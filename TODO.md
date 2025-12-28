# MedStint Clerk - Project Todo List

## 🔴 Critical Infrastructure & Security
- [ ] **Database Failover**: Implement database clustering and read replicas to prevent outages.
- [ ] **Data Encryption**: Implement field-level encryption for PII/PHI data (HIPAA compliance).
- [ ] **Environment Validation**: Add startup validation for critical environment variables in `src/lib/production-config.ts`.
- [ ] **API Security**: Implement centralized validation middleware for all API routes.

## 🟡 Feature Implementation Needed
### School Admin Dashboard
- [ ] **Import/Export Center** (`src/app/dashboard/school-admin/competencies/import-export/page.tsx`):
    - [ ] Integrate API for fetching import/export jobs.
    - [ ] Implement file upload handling and validation logic.
    - [ ] Connect "Export Now" to backend generation service.

### Clinical Supervisor Dashboard
- [ ] **Analytics** (`src/app/dashboard/clinical-supervisor/analytics/page.tsx`):
    - [ ] Replace mock data with actual API calls.
    - [ ] Implement "Performance Trends" chart.
    - [ ] Implement "Assessment Distribution" chart.
    - [ ] Implement "Competency Completion" and "Radar" charts.
    - [ ] Implement "Site Performance Comparison" chart.

### Admin Dashboard
- [ ] **Reports** (`src/app/dashboard/admin/reports/page.tsx`):
    - [ ] Replace mock data for "Monthly User Registrations".
    - [ ] Implement real data fetching for "Rotation Completion by School".
    - [ ] Implement real data fetching for "Evaluation Score Distribution".

### Billing
- [ ] **Subscription Limits**: Extend `Subscription` type to include `limits.tokens` (`src/app/dashboard/billing/page.tsx`).

## 🟡 Performance & Scalability
- [ ] **Query Optimization**: Implement adaptive batch sizing in `src/lib/optimized-query-wrapper.ts`.
- [ ] **Memory Management**: Optimize `src/lib/batch-processor.ts` to handle large bulk operations.
- [ ] **Session Storage**: Migrate session storage to Redis for staging/production.
- [ ] **Error Monitoring**: Integrate Sentry or similar service.

## 🟢 Enhancements
- [ ] **Documentation**: Standardize JSDoc comments across components.
- [ ] **Prop Validation**: Add runtime prop validation for critical components.
- [ ] **Real-time Updates**: Implement SSE or WebSockets for live dashboard updates.
