# MedStint Clinical Education Management - Database Schema Documentation

## Overview
This document provides comprehensive documentation of the MedStint Clinical Education Management database schema, including all tables, relationships, constraints, and stored procedures.

**Database**: PostgreSQL (Neon)  
**Project**: MedStint Clinical Education Management  
**Generated**: January 2025  
**Schema Version**: Current (with high-precision timing and enhanced features)

## Table of Contents
1. [Core Tables](#core-tables)
2. [User Management](#user-management)
3. [Educational Structure](#educational-structure)
4. [Competency Management](#competency-management)
5. [Time Tracking](#time-tracking)
6. [Analytics & Monitoring](#analytics--monitoring)
7. [System Tables](#system-tables)
8. [Stored Procedures](#stored-procedures)
9. [Database Relationships](#database-relationships)

---

## Core Tables

### users
**Purpose**: Central user management table for all system users
- **Primary Key**: `id` (text)
- **Unique Constraints**: `email`
- **Key Fields**:
  - `email` (text, NOT NULL) - User email address
  - `name` (text) - Full name
  - `role` (text, NOT NULL) - User role (student, instructor, admin, etc.)
  - `school_id` (text) - Associated school
  - `onboarding_completed` (boolean, default: false)
  - `dashboard_tutorial_completed` (boolean, default: false)
  - `created_at`, `updated_at` (timestamp)

### schools
**Purpose**: Educational institutions using the platform
- **Primary Key**: `id` (text)
- **Key Fields**:
  - `name` (text, NOT NULL) - School name
  - `domain` (text) - Email domain for automatic user assignment
  - `settings` (jsonb) - School-specific configuration
  - `subscription_tier` (text) - Subscription level
  - `is_active` (boolean, default: true)

### programs
**Purpose**: Academic programs within schools
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `school_id` → `schools.id`
- **Key Fields**:
  - `name` (text, NOT NULL) - Program name
  - `description` (text) - Program description
  - `duration_weeks` (integer) - Program length
  - `requirements` (jsonb) - Program requirements

---

## User Management

### accounts
**Purpose**: OAuth/external authentication accounts
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `type` (text, NOT NULL) - Account type (oauth, credentials)
  - `provider` (text, NOT NULL) - Provider (google, github, etc.)
  - `provider_account_id` (text, NOT NULL) - External account ID

### sessions
**Purpose**: User session management
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `session_token` (text, NOT NULL, UNIQUE) - Session identifier
  - `expires` (timestamp, NOT NULL) - Session expiration

### verification_tokens
**Purpose**: Email verification and password reset tokens
- **Primary Key**: `token` (text)
- **Key Fields**:
  - `identifier` (text, NOT NULL) - Email or user identifier
  - `expires` (timestamp, NOT NULL) - Token expiration

---

## Educational Structure

### students
**Purpose**: Student-specific information and academic tracking
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `school_id` → `schools.id`
  - `program_id` → `programs.id`
- **Key Fields**:
  - `student_id` (text) - External student identifier
  - `enrollment_date` (date) - Program enrollment date
  - `expected_graduation` (date) - Expected graduation date
  - `academic_status` (text) - Current academic standing

### clinical_preceptors
**Purpose**: Clinical supervisors and mentors
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `school_id` → `schools.id`
- **Key Fields**:
  - `license_number` (text) - Professional license
  - `specialties` (text[]) - Areas of expertise
  - `is_active` (boolean, default: true)

### clinical_supervisors
**Purpose**: Academic supervisors overseeing clinical education
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `school_id` → `schools.id`
- **Key Fields**:
  - `department` (text) - Academic department
  - `title` (text) - Academic title
  - `permissions` (jsonb) - System permissions

### clinical_sites
**Purpose**: Clinical rotation locations
- **Primary Key**: `id` (text)
- **Key Fields**:
  - `name` (text, NOT NULL) - Site name
  - `address` (text) - Physical address
  - `contact_info` (jsonb) - Contact information
  - `specialties` (text[]) - Available specialties
  - `capacity` (integer) - Student capacity

### rotations
**Purpose**: Clinical rotation assignments
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `student_id` → `students.id`
  - `clinical_site_id` → `clinical_sites.id`
  - `preceptor_id` → `clinical_preceptors.id`
- **Key Fields**:
  - `name` (text, NOT NULL) - Rotation name
  - `start_date`, `end_date` (date) - Rotation period
  - `specialty` (text) - Clinical specialty
  - `status` (text) - Current status

---

## Competency Management

### competencies
**Purpose**: Learning objectives and competency definitions
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `program_id` → `programs.id`
- **Key Fields**:
  - `title` (text, NOT NULL) - Competency title
  - `description` (text) - Detailed description
  - `category` (text) - Competency category
  - `level` (text) - Difficulty/complexity level
  - `is_required` (boolean, default: true)

### competency_templates
**Purpose**: Reusable competency templates
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `created_by` → `users.id`
- **Key Fields**:
  - `name` (text, NOT NULL) - Template name
  - `description` (text) - Template description
  - `template_data` (jsonb) - Template structure
  - `is_public` (boolean, default: false)

### competency_deployments
**Purpose**: Deployment of competency templates to schools
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `template_id` → `competency_templates.id`
  - `school_id` → `schools.id`
  - `competency_id` → `competencies.id`
  - `deployed_by` → `users.id`
- **Key Fields**:
  - `deployment_date` (timestamp) - When deployed
  - `configuration` (jsonb) - Deployment settings
  - `is_active` (boolean, default: true)

### competency_assignments
**Purpose**: Assignment of competencies to students
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `deployment_id` → `competency_deployments.id`
  - `user_id` → `users.id`
  - `competency_id` → `competencies.id`
  - `program_id` → `programs.id`
  - `assigned_by` → `users.id`
- **Key Fields**:
  - `assigned_date` (timestamp) - Assignment date
  - `due_date` (timestamp) - Completion deadline
  - `status` (text) - Assignment status
  - `priority` (text) - Assignment priority

### competency_submissions
**Purpose**: Student submissions for competency assessments
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `assignment_id` → `competency_assignments.id`
  - `user_id` → `users.id`
  - `competency_id` → `competencies.id`
  - `reviewed_by` → `users.id`
- **Key Fields**:
  - `submission_data` (jsonb) - Submission content
  - `submitted_at` (timestamp) - Submission time
  - `status` (text) - Review status
  - `score` (numeric) - Assessment score
  - `feedback` (text) - Reviewer feedback

### competency_assessments
**Purpose**: Formal competency evaluations
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `student_id` → `students.id`
  - `competency_id` → `competencies.id`
  - `clinical_supervisor_id` → `clinical_supervisors.id`
- **Key Fields**:
  - `assessment_date` (timestamp) - Evaluation date
  - `score` (numeric) - Assessment score
  - `feedback` (text) - Detailed feedback
  - `status` (text) - Assessment status

### competency_rubrics
**Purpose**: Scoring rubrics for competency assessments
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `competency_id` → `competencies.id`
  - `school_id` → `schools.id`
  - `created_by` → `users.id`
- **Key Fields**:
  - `name` (text, NOT NULL) - Rubric name
  - `criteria` (jsonb) - Scoring criteria
  - `scale` (jsonb) - Scoring scale
  - `is_active` (boolean, default: true)

### competency_versions
**Purpose**: Version control for competency changes
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `competency_id` → `competencies.id`
  - `changed_by` → `users.id`
- **Key Fields**:
  - `version_number` (integer) - Version identifier
  - `changes` (jsonb) - Change details
  - `change_reason` (text) - Reason for change
  - `created_at` (timestamp) - Change timestamp

---

## Time Tracking

### time_records
**Purpose**: Student clinical hour tracking with high-precision timing and location verification
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `student_id` → `users.id`
  - `rotation_id` → `rotations.id`
  - `approved_by` → `users.id`
- **Key Fields**:
  - `date` (timestamp) - Record date
  - `clock_in` (timestamp) - Clock in time with high precision
  - `clock_out` (timestamp) - Clock out time with high precision
  - `total_hours` (decimal, precision: 4, scale: 2) - Calculated hours with decimal precision
  - `activities` (text) - Activities performed (JSON array)
  - `notes` (text) - Additional notes
  - `status` (text) - Approval status (PENDING, APPROVED, REJECTED)
- **Location Tracking Fields**:
  - `clock_in_latitude` (decimal, precision: 10, scale: 8) - Clock-in GPS latitude
  - `clock_in_longitude` (decimal, precision: 11, scale: 8) - Clock-in GPS longitude
  - `clock_out_latitude` (decimal, precision: 10, scale: 8) - Clock-out GPS latitude
  - `clock_out_longitude` (decimal, precision: 11, scale: 8) - Clock-out GPS longitude
  - `clock_in_ip_address` (text) - IP address at clock-in
  - `clock_out_ip_address` (text) - IP address at clock-out
  - `clock_in_user_agent` (text) - Browser/device info at clock-in
  - `clock_out_user_agent` (text) - Browser/device info at clock-out

### timecard_corrections
**Purpose**: Corrections and adjustments to time records
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `time_record_id` → `time_records.id`
  - `requested_by` → `users.id`
  - `approved_by` → `users.id`
- **Key Fields**:
  - `original_hours` (numeric) - Original hours
  - `corrected_hours` (numeric) - Corrected hours
  - `reason` (text) - Correction reason
  - `status` (text) - Approval status
  - `requested_at` (timestamp) - Request time

---

## Analytics & Monitoring

### learning_analytics
**Purpose**: Learning progress and performance analytics
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `school_id` → `schools.id`
  - `program_id` → `programs.id`
  - `competency_id` → `competencies.id`
- **Key Fields**:
  - `metric_type` (text) - Type of metric
  - `metric_value` (numeric) - Metric value
  - `metadata` (jsonb) - Additional data
  - `recorded_at` (timestamp) - Record time

### onboarding_analytics
**Purpose**: User onboarding progress tracking
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `session_id` → `onboarding_sessions.id`
- **Key Fields**:
  - `event_type` (text) - Event category
  - `step` (text) - Onboarding step
  - `duration_ms` (integer) - Time spent
  - `metadata` (jsonb) - Event details

### onboarding_sessions
**Purpose**: Onboarding session management
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `started_at` (timestamp) - Session start
  - `completed_at` (timestamp) - Session completion
  - `current_step` (text) - Current progress
  - `metadata` (jsonb) - Session data

### progress_snapshots
**Purpose**: Point-in-time progress snapshots
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
  - `assignment_id` → `competency_assignments.id`
  - `competency_id` → `competencies.id`
- **Key Fields**:
  - `snapshot_date` (timestamp) - Snapshot time
  - `progress_percentage` (numeric) - Completion percentage
  - `metadata` (jsonb) - Progress details

### query_performance_log
**Purpose**: Database query performance monitoring and optimization
- **Primary Key**: `id` (text)
- **Key Fields**:
  - `query_hash` (text) - Unique query identifier for caching
  - `query_type` (text) - Query category (SELECT, INSERT, UPDATE, DELETE)
  - `table_name` (text) - Primary table being queried
  - `execution_time_ms` (integer) - High-precision execution time in milliseconds
  - `rows_examined` (integer) - Number of rows scanned
  - `rows_returned` (integer) - Number of rows returned
  - `endpoint` (text) - API endpoint that triggered the query
  - `user_id` (text) - User context for the query
  - `school_id` (text) - School context for multi-tenant filtering
  - `created_at` (timestamp) - Query execution timestamp

---

## System Tables

### audit_logs
**Purpose**: System audit trail
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `action` (text, NOT NULL) - Action performed
  - `resource_type` (text) - Resource affected
  - `resource_id` (text) - Resource identifier
  - `changes` (jsonb) - Change details
  - `ip_address` (text) - User IP
  - `user_agent` (text) - Browser info

### notifications
**Purpose**: User notification system
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `type` (text, NOT NULL) - Notification type
  - `title` (text, NOT NULL) - Notification title
  - `message` (text) - Notification content
  - `is_read` (boolean, default: false)
  - `metadata` (jsonb) - Additional data

### notification_queue
**Purpose**: Notification delivery queue
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `notification_type` (text) - Type of notification
  - `recipient_email` (text) - Delivery address
  - `subject` (text) - Email subject
  - `body` (text) - Email body
  - `status` (text) - Delivery status
  - `scheduled_for` (timestamp) - Delivery time

### notification_templates
**Purpose**: Reusable notification templates
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `school_id` → `schools.id`
  - `created_by` → `users.id`
- **Key Fields**:
  - `name` (text, NOT NULL) - Template name
  - `type` (text) - Template type
  - `subject_template` (text) - Subject template
  - `body_template` (text) - Body template
  - `variables` (jsonb) - Template variables

### documents
**Purpose**: File and document management
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `user_id` → `users.id`
- **Key Fields**:
  - `filename` (text, NOT NULL) - Original filename
  - `file_path` (text) - Storage path
  - `file_size` (integer) - File size in bytes
  - `mime_type` (text) - File MIME type
  - `metadata` (jsonb) - File metadata

### import_export_logs
**Purpose**: Data import/export operation tracking
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `school_id` → `schools.id`
  - `initiated_by` → `users.id`
- **Key Fields**:
  - `operation_type` (text) - Import or export
  - `entity_type` (text) - Data type processed
  - `status` (text) - Operation status
  - `records_processed` (integer) - Record count
  - `error_details` (jsonb) - Error information

### subscriptions
**Purpose**: School subscription management
- **Primary Key**: `id` (text)
- **Foreign Keys**: 
  - `school_id` → `schools.id`
- **Key Fields**:
  - `stripe_subscription_id` (text) - Stripe identifier
  - `status` (text) - Subscription status
  - `current_period_start` (timestamp) - Billing period start
  - `current_period_end` (timestamp) - Billing period end
  - `plan_id` (text) - Subscription plan

### accreditation_options
**Purpose**: Accreditation body configuration
- **Primary Key**: `id` (text)
- **Key Fields**:
  - `name` (text, NOT NULL) - Accreditation body name
  - `description` (text) - Description
  - `requirements` (jsonb) - Specific requirements
  - `is_active` (boolean, default: true)

### users_sync
**Purpose**: User synchronization tracking
- **Primary Key**: `id` (text)
- **Key Fields**:
  - `external_id` (text) - External system ID
  - `sync_status` (text) - Synchronization status
  - `last_synced` (timestamp) - Last sync time
  - `sync_data` (jsonb) - Sync metadata

### _prisma_migrations
**Purpose**: Database migration tracking (Prisma ORM)
- **Primary Key**: `id` (varchar)
- **Key Fields**:
  - `checksum` (varchar) - Migration checksum
  - `finished_at` (timestamptz) - Completion time
  - `migration_name` (varchar) - Migration identifier
  - `logs` (text) - Migration logs
  - `rolled_back_at` (timestamptz) - Rollback time
  - `started_at` (timestamptz) - Start time
  - `applied_steps_count` (integer) - Steps completed

---

## Stored Procedures

### track_onboarding_event
**Purpose**: Records onboarding analytics events
- **Parameters**:
  - `p_user_id` (text) - User identifier
  - `p_session_id` (text) - Session identifier
  - `p_event_type` (text) - Event category
  - `p_step` (text) - Onboarding step
  - `p_duration_ms` (integer) - Duration in milliseconds
  - `p_metadata` (jsonb) - Event metadata
- **Returns**: `text` - Event ID

### log_slow_query
**Purpose**: Logs slow database queries for performance monitoring
- **Parameters**:
  - `p_query_hash` (text) - Query identifier
  - `p_query_type` (text) - Query category
  - `p_table_name` (text) - Primary table
  - `p_execution_time_ms` (integer) - Execution time
  - `p_rows_examined` (integer) - Rows examined
  - `p_rows_returned` (integer) - Rows returned
  - `p_query_plan_hash` (text) - Execution plan hash
  - `p_endpoint` (text) - API endpoint
  - `p_user_id` (text) - User context
  - `p_school_id` (text) - School context
  - `p_query_sample` (text) - Query sample
- **Returns**: `void`
- **Logic**: Only logs queries with execution time > 100ms

### cleanup_query_performance_log
**Purpose**: Removes old query performance logs
- **Parameters**: None
- **Returns**: `integer` - Number of deleted records
- **Logic**: Deletes logs older than 30 days

### track_onboarding_event (Trigger)
**Purpose**: Automatically tracks onboarding completion events
- **Trigger On**: `users` table UPDATE
- **Logic**: 
  - Tracks when `onboarding_completed` changes to true
  - Tracks when `dashboard_tutorial_completed` changes to true
  - Inserts corresponding analytics records

---

## Database Relationships

### Primary Relationships

#### User-Centric Relationships
- `users` ← `accounts` (OAuth accounts)
- `users` ← `sessions` (User sessions)
- `users` ← `students` (Student profiles)
- `users` ← `clinical_preceptors` (Preceptor profiles)
- `users` ← `clinical_supervisors` (Supervisor profiles)
- `users` ← `notifications` (User notifications)
- `users` ← `documents` (User documents)
- `users` ← `audit_logs` (User actions)

#### Educational Structure
- `schools` ← `programs` (School programs)
- `schools` ← `students` (School enrollment)
- `schools` ← `clinical_preceptors` (School staff)
- `schools` ← `clinical_supervisors` (School supervisors)
- `schools` ← `subscriptions` (School billing)

#### Competency Framework
- `programs` ← `competencies` (Program competencies)
- `competencies` ← `competency_assessments` (Competency evaluations)
- `competencies` ← `competency_assignments` (Student assignments)
- `competencies` ← `competency_submissions` (Student submissions)
- `competencies` ← `competency_rubrics` (Scoring rubrics)
- `competencies` ← `competency_versions` (Version history)

#### Clinical Education
- `students` ← `rotations` (Clinical rotations)
- `students` ← `time_records` (Time tracking)
- `clinical_sites` ← `rotations` (Rotation locations)
- `clinical_preceptors` ← `rotations` (Rotation supervision)
- `time_records` ← `timecard_corrections` (Time corrections)

#### Analytics & Tracking
- `users` ← `onboarding_sessions` (Onboarding tracking)
- `onboarding_sessions` ← `onboarding_analytics` (Onboarding events)
- `users` ← `learning_analytics` (Learning metrics)
- `competency_assignments` ← `progress_snapshots` (Progress tracking)

### Constraint Summary
- **Primary Keys**: 47 tables with unique identifiers
- **Foreign Keys**: 89 relationships ensuring referential integrity
- **Unique Constraints**: Email uniqueness, session tokens, verification tokens
- **Check Constraints**: Data validation at database level

### Indexing Strategy
The database employs strategic indexing on:
- Primary keys (automatic)
- Foreign key columns for join performance
- Frequently queried columns (email, dates, status fields)
- Composite indexes for complex queries

---

## Performance Considerations

### High-Precision Timing System
- Millisecond-accurate timestamps for time tracking
- High-precision decimal fields for hour calculations
- Performance monitoring with execution time tracking
- WebSocket integration for real-time synchronization

### Query Optimization
- Stored procedures for complex operations
- Query performance logging with millisecond precision
- Automatic cleanup of old performance logs
- Query hash caching for repeated operations
- Optimized indexes on frequently accessed columns

### Scalability Features
- JSONB columns for flexible schema evolution
- Efficient relationship modeling with proper foreign keys
- Comprehensive audit trail for compliance and debugging
- Notification queue for asynchronous processing
- Location tracking with high-precision GPS coordinates
- Multi-tenant architecture with school-based filtering

### Mobile Optimization
- Geolocation tracking with latitude/longitude precision
- IP address and user agent logging for security
- Optimized mobile data structures
- Efficient location-based queries

### Cost Optimization
- Automated log cleanup procedures (30-day retention)
- Efficient data types (text vs varchar)
- Strategic use of nullable columns
- Batch processing capabilities through stored procedures
- Connection pooling and query optimization

### Real-Time Features
- WebSocket support for live updates
- High-precision timing for accurate time tracking
- Real-time progress synchronization
- Instant notification delivery

---

*This documentation reflects the current state of the MedStint Clinical Education Management database schema as of December 2024. For updates or questions, please contact the development team.*