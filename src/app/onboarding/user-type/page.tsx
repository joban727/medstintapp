import { currentUser } from "@clerk/nextjs/server"
import { eq, and } from "drizzle-orm"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { db } from "@/database/connection-pool"
import { users, schools, programs, invitations } from "../../../database/schema"
import type { UserRole } from "../../../types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
interface UserData {
  id: string
  email: string
  name: string
  role: UserRole | null
  schoolId: string | null
  programId: string | null
}

export default async function UserTypeSelectionPage() {
  const clerkUser = await currentUser()

  // Handle session establishment timing issues for new users
  if (!clerkUser) {
    // No Clerk user found

    // Check if we have valid Clerk keys before redirecting
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    const secretKey = process.env.CLERK_SECRET_KEY

    if (
      !publishableKey ||
      !secretKey ||
      publishableKey === "pk_test_placeholder" ||
      secretKey === "sk_test_placeholder" ||
      publishableKey.includes("placeholder") ||
      secretKey.includes("placeholder")
    ) {
      // Invalid Clerk configuration detected
      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
            <h1 className="mb-4 font-bold text-2xl text-red-600">
              Authentication Configuration Error
            </h1>
            <p className="mb-4 text-gray-600">
              The authentication system is not properly configured. Please check your Clerk API
              keys.
            </p>
            <p className="text-gray-500 text-sm">
              If you are an administrator, please update the CLERK_SECRET_KEY in your environment
              variables.
            </p>
          </div>
        </div>
      )
    }

    redirect("/auth/sign-in")
  }

  // Check if user already exists and has completed onboarding
  let user = null as {
    id: string
    email: string | null
    name: string | null
    role: string | null
    schoolId: string | null
    programId: string | null
    onboardingCompleted: boolean | null
  } | null

  try {
    const [dbUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        programId: users.programId,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.id, clerkUser.id))
      .limit(1)
    user = dbUser
  } catch (error) {
    console.error("❌ UserTypeSelectionPage: Database error:", error)
  }

  // Helper: verify user meets role-specific requirements
  const meetsRoleRequirements = (u: typeof user): boolean => {
    if (!u) return false
    switch (u.role) {
      case "SUPER_ADMIN":
        return true
      case "SCHOOL_ADMIN":
      case "CLINICAL_PRECEPTOR":
      case "CLINICAL_SUPERVISOR":
        return Boolean(u.schoolId)
      case "STUDENT":
        return Boolean(u.schoolId && u.programId)
      default:
        return false
    }
  }

  // If user has already completed onboarding, redirect straight to dashboard
  if (user && user.onboardingCompleted) {
    // User has completed onboarding and meets requirements, redirect to dashboard
    console.log("✅ UserTypeSelectionPage: User has completed onboarding, redirecting to dashboard")

    // Redirect to appropriate dashboard based on role
    switch (user.role) {
      case "SUPER_ADMIN":
        redirect("/dashboard/admin")
      case "SCHOOL_ADMIN":
        redirect("/dashboard/school-admin")
      case "CLINICAL_SUPERVISOR":
        redirect("/dashboard/clinical-supervisor")
      case "CLINICAL_PRECEPTOR":
        redirect("/dashboard/clinical-preceptor")
      case "STUDENT":
        redirect("/dashboard/student")
      default:
        redirect("/dashboard")
    }
  }

  // If we reach here, user needs to complete onboarding
  // Either user doesn't exist, hasn't completed onboarding, or doesn't meet role requirements

  // Extract serializable properties from Clerk user
  const serializableClerkUser = {
    id: clerkUser.id,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    emailAddresses: clerkUser.emailAddresses.map((email) => ({
      id: email.id,
      emailAddress: email.emailAddress,
      verification: email.verification
        ? {
          status: email.verification.status,
          strategy: email.verification.strategy,
        }
        : null,
      linkedTo: email.linkedTo.map((link) => link.id),
    })),
  }

  // If user doesn't exist in database, create them
  if (!user) {
    // User not found in database, creating new user
    console.log("🔄 UserTypeSelectionPage: Creating new user in database")

    try {
      const userEmail = clerkUser.emailAddresses[0]?.emailAddress
      const firstName = clerkUser.firstName?.trim() || ""
      const lastName = clerkUser.lastName?.trim() || ""
      const fullName = `${firstName} ${lastName}`.trim()
      const userName = fullName === "" ? null : fullName

      if (!userEmail) {
        // No email found for user
        console.error("❌ UserTypeSelectionPage: No email found for user")
        redirect("/auth/sign-in")
      }

      // First check if a user with this email already exists (different ID)
      const [existingUserByEmail] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          schoolId: users.schoolId,
          programId: users.programId,
          onboardingCompleted: users.onboardingCompleted,
        })
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1)

      if (existingUserByEmail) {
        // User with email exists but different Clerk ID
        // This can happen when a user signs up with a different auth method
        // We'll use the existing user record and update the name if needed
        console.log("🔄 UserTypeSelectionPage: Found existing user by email, updating")

        const [updatedUser] = await db
          .update(users)
          .set({
            name: userName || existingUserByEmail.name,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userEmail))
          .returning({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            schoolId: users.schoolId,
            programId: users.programId,
            onboardingCompleted: users.onboardingCompleted,
          })

        user = updatedUser
        console.log("✅ UserTypeSelectionPage: Successfully updated existing user record")
      } else {
        // No existing user with this email, create new one
        console.log("🔄 UserTypeSelectionPage: Creating completely new user record")

        try {
          // Check for PENDING invitation to determine approval status
          const [invitation] = await db
            .select()
            .from(invitations)
            .where(
              and(
                eq(invitations.email, userEmail),
                eq(invitations.status, "PENDING")
              )
            )
            .limit(1)

          // Only approve if they have a PENDING invitation
          const approvalStatus: "APPROVED" | "PENDING" = invitation ? "APPROVED" : "PENDING"

          const insertValues = {
            id: clerkUser.id,
            email: userEmail,
            name: userName ?? null,
            emailVerified: false,
            onboardingCompleted: false,
            isActive: true,
            approvalStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
          }

          const inserted = await db
            .insert(users)
            .values(insertValues)
            .onConflictDoNothing()
            .returning({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              schoolId: users.schoolId,
              programId: users.programId,
              onboardingCompleted: users.onboardingCompleted,
            })

          if (inserted.length > 0) {
            user = inserted[0]
          } else {
            const [existingByEmail] = await db
              .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                schoolId: users.schoolId,
                programId: users.programId,
                onboardingCompleted: users.onboardingCompleted,
              })
              .from(users)
              .where(eq(users.email, userEmail))
              .limit(1)
            user = existingByEmail
          }
        } catch (insertError) {
          console.error("❌ UserTypeSelectionPage: Insert/upsert failed:", insertError)
          // Attempt to fetch by email as a fallback
          try {
            const [existingByEmail] = await db
              .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                schoolId: users.schoolId,
                programId: users.programId,
                onboardingCompleted: users.onboardingCompleted,
              })
              .from(users)
              .where(eq(users.email, userEmail))
              .limit(1)
            if (existingByEmail) {
              user = existingByEmail
              console.log("✅ UserTypeSelectionPage: Fallback loaded existing user by email")
            } else {
              throw insertError
            }
          } catch (fallbackError) {
            console.error("❌ UserTypeSelectionPage: Fallback by email failed:", fallbackError)
            // Re-throw to be handled by outer catch
            throw insertError
          }
        }
      }
    } catch (error) {
      console.error("❌ UserTypeSelectionPage: Failed to create/update user:", error)
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack)
      }

      // If still getting duplicate key error, try to fetch by Clerk ID one more time
      if (error instanceof Error && error.message.includes("duplicate key")) {
        try {
          const [existingUser] = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              schoolId: users.schoolId,
              programId: users.programId,
              onboardingCompleted: users.onboardingCompleted,
            })
            .from(users)
            .where(eq(users.id, clerkUser.id))
            .limit(1)
          user = existingUser
          console.log("✅ UserTypeSelectionPage: Found existing user on retry")
        } catch (retryError) {
          console.error("❌ UserTypeSelectionPage: Final retry failed:", retryError)
          // Show error instead of redirecting to prevent loops
          return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
              <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
                <h1 className="mb-4 font-bold text-2xl text-red-600">Database Error</h1>
                <p className="mb-4 text-gray-600">Unable to load your user profile. Please try refreshing the page.</p>
                <a href="/onboarding/user-type" className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Refresh Page</a>
              </div>
            </div>
          )
        }
      } else {
        // Show error instead of redirecting to prevent loops
        return (
          <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
              <h1 className="mb-4 font-bold text-2xl text-red-600">Setup Error</h1>
              <p className="mb-4 text-gray-600">There was an issue setting up your account. Please try refreshing the page.</p>
              <a href="/onboarding/user-type" className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Refresh Page</a>
            </div>
          </div>
        )
      }
    }
  }

  // Validate user has minimum required fields
  if (!user || !user.email) {
    console.error("❌ UserTypeSelectionPage: User missing required fields:", { user })
    // Show error instead of redirecting to prevent loops
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-lg">
          <h1 className="mb-4 font-bold text-2xl text-red-600">Account Setup Required</h1>
          <p className="mb-4 text-gray-600">Unable to find your account information. Please try signing out and signing in again.</p>
          <a href="/auth/sign-out" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Sign Out</a>
        </div>
      </div>
    )
  }

  // Transform user to match UserData interface
  const userData: UserData = {
    id: user.id,
    email: user.email,
    name: user.name || "User",
    role: (user.role as UserRole) || null,
    schoolId: user.schoolId,
    programId: user.programId,
  }

  // Fetch available schools and programs for onboarding selection
  let availableSchoolsData: Array<{
    id: string
    name: string
    address: string
    email: string
    isActive: boolean
  }> = []
  let availableProgramsData: Array<{
    id: string
    name: string
    description: string
    schoolId: string
  }> = []

  try {
    const schoolsRows = await db
      .select({
        id: schools.id,
        name: schools.name,
        address: schools.address,
        email: schools.email,
        isActive: schools.isActive,
      })
      .from(schools)
      .where(eq(schools.isActive, true))

    availableSchoolsData = schoolsRows.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address || "",
      email: s.email || "",
      isActive: s.isActive ?? true,
    }))

    const programsRows = await db
      .select({
        id: programs.id,
        name: programs.name,
        description: programs.description,
        schoolId: programs.schoolId,
        isActive: programs.isActive,
      })
      .from(programs)
      .where(eq(programs.isActive, true))

    availableProgramsData = programsRows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      schoolId: p.schoolId,
    }))
  } catch (err) {
    console.error("❌ UserTypeSelectionPage: Failed to fetch schools/programs:", err)
  }

  console.log("✅ UserTypeSelectionPage: Rendering onboarding flow for user:", userData.email)

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-8">
      <OnboardingFlow
        user={userData}
        clerkUser={serializableClerkUser}
        availableSchools={availableSchoolsData}
        availablePrograms={availableProgramsData}
        initialStep="role-selection"
        initialRole={userData.role ?? undefined}
      />
    </div>
  )
}
