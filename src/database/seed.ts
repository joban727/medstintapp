// TODO: Replace with actual user data from authentication system
// Users will be created through Clerk authentication
const _seedUsers: never[] = []
const _seedRotations: never[] = []
const _seedTimeRecords: never[] = []

// TODO: Replace with actual school data from admin interface
// Schools will be created through the application admin panel
const _seedSchools: never[] = []
const _seedAssessments: never[] = []

// TODO: Replace with actual clinical sites data from admin interface
// Clinical sites will be created through the application admin panel
const _seedClinicalSites: never[] = []
const _seedEvaluations: never[] = []

// TODO: Replace with actual programs data from admin interface
// Programs will be created through the application admin panel
const _seedPrograms: never[] = []
const _seedStudentRotations: never[] = []

// TODO: Replace with actual competencies data from admin interface
// Competencies will be created through the application admin panel
const _seedCompetencies: never[] = []

export async function seedDatabase() {
  try {
    console.log("🌱 Database seeding skipped - using production data sources")
    console.log("ℹ️  Users will be created through Clerk authentication")
    console.log(
      "ℹ️  Schools, clinical sites, programs, and competencies will be created through admin interface"
    )
    console.log("✅ Database initialization completed successfully!")
  } catch (error) {
    console.error("❌ Error initializing database:", error)
    throw error
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      // Seeding completed
      process.exit(0)
    })
    .catch((_error) => {
      // Seeding failed
      process.exit(1)
    })
}
