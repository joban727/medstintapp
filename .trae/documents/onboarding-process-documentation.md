# MedStint Onboarding Process Documentation

## 1. Overview

The MedStint onboarding process is designed to guide new users through account setup based on their role in the clinical education ecosystem. The system supports five distinct user types with tailored workflows that ensure proper configuration and access control.

### Supported User Roles
- **SUPER_ADMIN**: System-wide administrative access
- **SCHOOL_ADMIN**: Institution-level management
- **CLINICAL_PRECEPTOR**: Direct student supervision at clinical sites
- **CLINICAL_SUPERVISOR**: Oversight of clinical education programs
- **STUDENT**: Clinical education participants

## 2. Onboarding Workflow Architecture

### 2.1 Entry Points

| Route | Purpose | Target Users |
|-------|---------|-------------|
| `/onboarding/user-type` | Initial role selection | All new users |
| `/onboarding/student` | Student-specific flow | Students |
| `/onboarding/school` | Institution setup | School Admins, Clinical Staff |
| `/onboarding/super-admin` | System admin setup | Super Admins |
| `/onboarding/complete` | Completion confirmation | All users |

### 2.2 Onboarding Verification System

The system uses `onboarding-verification.ts` to ensure:
- **Authentication validation** via Clerk integration
- **Role-based requirements** checking
- **Completion status** tracking
- **Redirect management** to appropriate flows

#### Role Requirements Matrix

| Role | Required Fields | Validation Rules |
|------|----------------|------------------|
| SUPER_ADMIN | Basic profile | No additional requirements |
| SCHOOL_ADMIN | schoolId | Must be associated with a school |
| CLINICAL_PRECEPTOR | schoolId | Must be associated with a school |
| CLINICAL_SUPERVISOR | schoolId | Must be associated with a school |
| STUDENT | schoolId, programId | Must be enrolled in a program |

## 3. User Type Specific Workflows

### 3.1 Student Onboarding Flow

**Steps:**
1. **Welcome** - Introduction and overview
2. **Personal Info** - Basic profile completion
3. **School Selection** - Choose from available institutions
4. **Program Selection** - Select academic program
5. **Enrollment Confirmation** - Verify selections
6. **Complete** - Finalization and dashboard access

**Key Features:**
- Program filtering by selected school
- Academic status initialization
- Clinical hours tracking setup
- Competency assignment preparation

### 3.2 School Administrator Onboarding Flow

**Steps:**
1. **Welcome** - Role introduction
2. **Role Selection** - Confirm administrative role
3. **School Info** - Institution details setup
4. **Programs** - Academic program configuration
5. **Admin Setup** - Administrator profile completion
6. **Complete** - Dashboard access and next steps

**Program Configuration:**
- Program creation with duration and class year
- Requirements specification (JSON array)
- Multiple program support
- Integration with competency templates

### 3.3 Clinical Staff Onboarding Flow

**Steps:**
1. **Welcome** - Role-specific introduction
2. **Role Selection** - Preceptor vs Supervisor distinction
3. **School Selection** - Institution affiliation
4. **Affiliation Setup** - Clinical site associations
5. **Complete** - Access to supervision tools

## 4. Program Management Integration

### 4.1 Current Program Features

Based on the `/api/programs` endpoint and database schema:

**Program Properties:**
- `name`: Program title
- `description`: Detailed program information
- `duration`: Length in months
- `classYear`: Expected graduation year
- `schoolId`: Associated institution
- `requirements`: JSON array of program requirements
- `isActive`: Status flag

**Program Statistics:**
- Total enrolled students
- Active students count
- Completion rates (when available)

### 4.2 Program Selection Logic

```javascript
// Programs are filtered by school during onboarding
availablePrograms.filter(program => program.schoolId === selectedSchool)
```

### 4.3 Program Requirements System

Programs can specify requirements as JSON arrays:
```json
[
  "Clinical Skills Assessment",
  "Background Check Completion",
  "Immunization Records",
  "CPR Certification"
]
```

## 5. Competency Management Integration

### 5.1 Competency Templates

The system includes comprehensive competency management:

**Template Types:**
- `COMPETENCY`: Individual skill assessments
- `RUBRIC`: Multi-criteria evaluation frameworks

**Competency Levels:**
- `FUNDAMENTAL`: Basic skills
- `INTERMEDIATE`: Developing proficiency
- `ADVANCED`: Skilled performance
- `EXPERT`: Mastery level

### 5.2 Deployment System

Competencies are deployed through:
- **Template Import**: Using standardized templates
- **Custom Creation**: School-specific competencies
- **Bulk Import**: Mass deployment capabilities

### 5.3 Assignment Integration

During onboarding completion:
- Students receive competency assignments based on their program
- Assignments include due dates and progress tracking
- Integration with clinical rotation requirements

## 6. Onboarding Completion Flow

### 6.1 Completion Verification

The `OnboardingCompletion` component provides:
- **Role-specific next steps**
- **Priority action items**
- **Dashboard navigation**
- **Quick action shortcuts**

### 6.2 Next Steps by Role

**School Administrators:**
- Invite Clinical Students
- Configure Programs
- Add Clinical Sites
- School Settings Configuration

**Students:**
- View Schedule
- Complete Profile
- Access Course Materials
- Connect with Peers

### 6.3 Atomic Completion Process

The system uses `/api/user/onboarding-complete` to:
- Mark onboarding as completed
- Prevent race conditions
- Clear temporary session data
- Redirect to appropriate dashboard

## 7. API Endpoints and Data Flow

### 7.1 Core Onboarding APIs

| Endpoint | Method | Purpose |
|----------|--------|----------|
| `/api/user/update` | POST | Update user profile during onboarding |
| `/api/schools/create` | POST | Create new school during admin setup |
| `/api/programs` | GET/POST | Program management |
| `/api/user/onboarding-complete` | POST | Finalize onboarding process |

### 7.2 Data Validation

All endpoints use Zod schemas for validation:
- User update validation
- School creation requirements
- Program configuration validation
- Role-based access control

## 8. Navigation and Dashboard Integration

### 8.1 Role-Based Dashboard Routing

```javascript
function getRoleDashboardRoute(role) {
  switch (role) {
    case "SUPER_ADMIN": return "/dashboard/admin"
    case "SCHOOL_ADMIN": return "/dashboard/school-admin"
    case "CLINICAL_SUPERVISOR": return "/dashboard/clinical-supervisor"
    case "CLINICAL_PRECEPTOR": return "/dashboard/clinical-preceptor"
    case "STUDENT": return "/dashboard/student"
    default: return "/dashboard"
  }
}
```

### 8.2 Navigation Structure

Post-onboarding navigation includes:
- **Overview**: Dashboard home
- **People Management**: User administration
- **Institution/Academic/Clinical Management**: Role-specific tools
- **Time Management**: Scheduling and tracking
- **Competency Management**: Assessment tools
- **Assessment & Evaluation**: Progress monitoring
- **Tools & Configuration**: System settings

## 9. Security and Verification Measures

### 9.1 Authentication Integration

- **Clerk Authentication**: Secure user management
- **JWT Token Validation**: API security
- **Role-Based Access Control**: Permission enforcement
- **Session Management**: Secure state handling

### 9.2 Data Protection

- **Input Validation**: Zod schema enforcement
- **SQL Injection Prevention**: Parameterized queries
- **CSRF Protection**: Token-based validation
- **Rate Limiting**: API abuse prevention

### 9.3 Onboarding State Management

- **Race Condition Prevention**: Atomic operations
- **Session Storage**: Temporary state management
- **Database Consistency**: Transaction-based updates
- **Error Recovery**: Graceful failure handling

## 10. Notification System Integration

### 10.1 Notification Templates

The system supports:
- **Email Notifications**: Welcome messages, next steps
- **In-App Notifications**: Progress updates
- **SMS Notifications**: Critical alerts
- **Push Notifications**: Mobile engagement

### 10.2 Trigger Events

- `DEPLOYMENT_CREATED`: New competency assignments
- `ASSIGNMENT_DUE`: Upcoming deadlines
- `ASSESSMENT_COMPLETED`: Progress milestones
- `REMINDER`: Follow-up actions

## 11. Performance and Optimization

### 11.1 Database Optimization

- **Connection Pooling**: Efficient resource management
- **Query Optimization**: Minimized N+1 queries
- **Batch Operations**: Bulk data processing
- **Caching Strategy**: Performance enhancement

### 11.2 User Experience

- **Progressive Loading**: Step-by-step completion
- **Error Handling**: User-friendly messages
- **Mobile Responsiveness**: Cross-device compatibility
- **Accessibility**: WCAG compliance

## 12. Monitoring and Analytics

### 12.1 Onboarding Metrics

- **Completion Rates**: Success tracking
- **Drop-off Points**: Optimization opportunities
- **Time to Complete**: Efficiency measurement
- **Error Rates**: Quality assurance

### 12.2 Performance Monitoring

- **API Response Times**: Performance tracking
- **Database Query Performance**: Optimization insights
- **User Journey Analytics**: Experience improvement
- **System Health Checks**: Reliability monitoring

## 13. Future Enhancements

### 13.1 Planned Features

- **Bulk User Import**: Mass onboarding capabilities
- **Custom Onboarding Flows**: Institution-specific workflows
- **Integration APIs**: Third-party system connections
- **Advanced Analytics**: Detailed reporting

### 13.2 Scalability Considerations

- **Microservices Architecture**: Service separation
- **Load Balancing**: Traffic distribution
- **Database Sharding**: Data partitioning
- **CDN Integration**: Global performance

This documentation reflects the current state of the MedStint onboarding system and should be updated as new features are implemented or existing workflows are modified.