import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { db } from "../../../database/db"
import { users } from "../../../database/schema"
import type { UserRole } from "../../../types"

interface UserData {
  id: string
  email: string
  name: string
  role: UserRole
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
    console.error("Database error:", error)
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

  // Check if user already exists and handle routing
  if (user) {
    // Found existing user in database

    // If user has completed onboarding and meets role requirements, redirect to dashboard
    if (user.onboardingCompleted && meetsRoleRequirements(user)) {
      // User has completed onboarding, redirecting

      // Redirect to appropriate dashboard based on role
      switch (user.role) {
        case "SUPER_ADMIN":
          redirect("/dashboard/admin")
          break
        case "SCHOOL_ADMIN":
          redirect("/dashboard/school-admin")
          break
        case "CLINICAL_SUPERVISOR":
          redirect("/dashboard/clinical-supervisor")
          break
        case "CLINICAL_PRECEPTOR":
          redirect("/dashboard/clinical-preceptor")
          break
        case "STUDENT":
          redirect("/dashboard/student")
          break
        default:
          redirect("/dashboard")
      }
    }

    // If user has a role but hasn't completed onboarding, redirect to appropriate step
    else if (user.role && !user.onboardingCompleted) {
      // User has role but incomplete onboarding

      // Redirect to appropriate onboarding flow based on role
      switch (user.role) {
        case "STUDENT":
          redirect("/onboarding/student")
          break
        case "SCHOOL_ADMIN":
        case "CLINICAL_SUPERVISOR":
        case "CLINICAL_PRECEPTOR":
          redirect("/onboarding/school")
          break
        case "SUPER_ADMIN":
          redirect("/onboarding/super-admin")
          break
        default:
          // Unknown role, staying on user-type page
          break
      }
    }

    // If user exists but has no role, continue to role selection
    // User exists but needs role selection
  } else {
    // No existing user found, will create new user below
    // No existing user found, will create new user
  }

  // Extract serializable properties from Clerk user
  const serializableClerkUser = {
    id: clerkUser.id,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    emailAddresses:
      clerkUser.emailAddresses?.map((email) => ({
        emailAddress: email.emailAddress,
        id: email.id,
        verification: email.verification
          ? {
              status: email.verification.status,
              strategy: email.verification.strategy,
            }
          : null,
        linkedTo: [],
      })) || [],
    imageUrl: clerkUser.imageUrl,
  }

  // If no user found in database, try to fetch again before creating
  if (!user) {
    // No user found, attempting retry fetch

    // Try one more time to fetch the user (in case it was just created by another request)
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

      if (existingUser) {
        // Found user on retry
        user = existingUser
      }
    } catch (_error) {
      // Retry fetch failed, will create new user
    }

    // Only create user if still not found after retry
    if (!user) {
      // Creating new user record

      try {
        const userEmail = clerkUser.emailAddresses[0]?.emailAddress
        const userName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim()

        if (!userEmail) {
          // No email found for user
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

          const [updatedUser] = await db
            .update(users)
            .set({
              name: userName || existingUserByEmail.name,
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
          // Successfully updated existing user record
        } else {
          // No existing user with this email, create new one
          // Creating completely new user record
          const [newUser] = await db
            .insert(users)
            .values({
              id: clerkUser.id,
              email: userEmail,
              name: userName || null,
              // role field omitted to use database default ("STUDENT")
              schoolId: null,
              programId: null,
              onboardingCompleted: false,
            })
            .returning({
              id: users.id,
              email: users.email,
              name: users.name,
              role: users.role,
              schoolId: users.schoolId,
              programId: users.programId,
              onboardingCompleted: users.onboardingCompleted,
            })

          user = newUser
          // Successfully created new user
        }
      } catch (error) {
        console.error("❌ UserTypeSelectionPage: Failed to create/update user:", error)

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
          } catch (retryError) {
            console.error("❌ UserTypeSelectionPage: Final retry failed:", retryError)
            redirect("/auth/sign-in")
          }
        } else {
          redirect("/auth/sign-in")
        }
      }
    }
  }

  // Validate user has minimum required fields
  if (!user || !user.email) {
    console.error("❌ UserTypeSelectionPage: User missing required fields:", { user })
    redirect("/auth/sign-in")
  }

  // Transform user to match UserData interface
  const userData: UserData = {
    id: user.id,
    email: user.email,
    name: user.name || "User",
    role: (user.role as UserRole) || "STUDENT",
    schoolId: user.schoolId,
    programId: user.programId,
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <OnboardingFlow
        user={userData}
        clerkUser={serializableClerkUser}
        availableSchools={[]}
        availablePrograms={[]}
        initialStep="role-selection"
      />
    </div>
  )
}
