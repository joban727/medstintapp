import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { StudentOnboarding } from "../../../components/onboarding/student-onboarding"
import { db } from "../../../database/db"
import { programs, schools, users } from "../../../database/schema"
// verifyOnboardingState import removed - verification handled by dashboard router

export default async function StudentOnboardingPage() {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    redirect("/auth/sign-in")
  }

  // Note: Onboarding verification is handled by the dashboard router
  // No need to verify again here as users are routed here appropriately

  // Create a serializable version of clerkUser to pass to Client Components
  const serializableClerkUser = {
    id: clerkUser.id,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    emailAddresses: clerkUser.emailAddresses?.map((email) => ({
      id: email.id,
      emailAddress: email.emailAddress,
    })),
    imageUrl: clerkUser.imageUrl,
  }

  try {
    // Get user data
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId,
        department: users.department,
        phone: users.phone,
        address: users.address,
        isActive: users.isActive,
        studentId: users.studentId,
        programId: users.programId,
        enrollmentDate: users.enrollmentDate,
        expectedGraduation: users.expectedGraduation,
        academicStatus: users.academicStatus,
        gpa: users.gpa,
        totalClinicalHours: users.totalClinicalHours,
        completedRotations: users.completedRotations,
        onboardingCompleted: users.onboardingCompleted,
        onboardingCompletedAt: users.onboardingCompletedAt,
        avatar: users.avatar,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1)

    // Get available schools and their programs
    const availableSchools = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        website: schools.website,
        accreditation: schools.accreditation,
      })
      .from(schools)
      .where(eq(schools.isActive, true))

    const availablePrograms = await db
      .select({
        id: programs.id,
        name: programs.name,
        description: programs.description,
        duration: programs.duration,
        requirements: programs.requirements,
        schoolId: programs.schoolId,
      })
      .from(programs)
      .where(eq(programs.isActive, true))

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-2xl">
          <StudentOnboarding
            user={user}
            clerkUser={serializableClerkUser}
            availableSchools={availableSchools}
            availablePrograms={availablePrograms}
          />
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error in student onboarding page:", error)

    // Fallback data in case of database error
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-2xl">
          <StudentOnboarding
            user={null}
            clerkUser={serializableClerkUser}
            availableSchools={[]}
            availablePrograms={[]}
          />
        </div>
      </div>
    )
  }
}
