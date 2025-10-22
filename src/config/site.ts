const site_url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"

export const site = {
  name: "MedStint",
  description:
    "Clinical Education Management System - Streamline medical education with comprehensive student tracking, clinical rotations, and competency assessments",
  url: site_url,
  ogImage: `${site_url}/og.jpg`,
  logo: "/logo-medstint.svg",
  mailSupport: "support@medstint.com", // Support email address
  mailFrom: process.env.MAIL_FROM || "noreply@medstint.com", // Transactional email address
  links: {
    twitter: "https://twitter.com/medstint",
    linkedin: "https://www.linkedin.com/company/medstint",
  },
  features: {
    clinicalRotations: "Comprehensive clinical rotation management",
    timeTracking: "Accurate time logging and approval workflows",
    competencyAssessment: "Skills validation and competency tracking",
    reporting: "Real-time analytics and compliance reporting",
    hipaaCompliant: "HIPAA-compliant data security and privacy",
  },
  userRoles: {
    superAdmin: "Complete system administration and oversight",
    schoolAdmin: "School-wide management and coordination",
    clinicalPreceptor: "Student mentoring and evaluation",
    clinicalSupervisor: "Competency assessment and skills validation",
    student: "Personal progress tracking and time logging",
  },
} as const
