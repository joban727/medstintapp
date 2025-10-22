import { eq } from "drizzle-orm"
import { db } from "../src/database/db"
import { schools, users } from "../src/database/schema"

/**
 * Quick fix script for immediate school_id consistency issues
 * Addresses the 2 users with invalid school references found in verification
 */

async function fixSchoolIdIssues() {
  console.log("🔧 Starting school_id issue fixes...")

  try {
    // First, let's see what schools exist
    const existingSchools = await db.select().from(schools)
    console.log("\n📋 Available schools:")
    existingSchools.forEach((school) => {
      console.log(`  - ${school.id}: ${school.name}`)
    })

    if (existingSchools.length === 0) {
      console.log("❌ No schools found in database. Cannot fix user references.")
      return
    }

    // Use the first available school as the default
    const defaultSchoolId = existingSchools[0].id
    console.log(`\n🎯 Using '${defaultSchoolId}' as default school for fixes`)

    // Find users with invalid school references
    const problematicUsers = await db
      .select()
      .from(users)
      .where(eq(users.email, "preceptor1@test.com"))

    const problematicUsers2 = await db
      .select()
      .from(users)
      .where(eq(users.email, "preceptor2@test.com"))

    const allProblematicUsers = [...problematicUsers, ...problematicUsers2]

    if (allProblematicUsers.length === 0) {
      console.log("✅ No problematic users found. Issues may have been resolved.")
      return
    }

    console.log(`\n🔍 Found ${allProblematicUsers.length} users with invalid school references:`)
    allProblematicUsers.forEach((user) => {
      console.log(`  - ${user.email}: currently references '${user.schoolId}'`)
    })

    // Fix the invalid references
    let fixedCount = 0

    for (const user of allProblematicUsers) {
      try {
        await db.update(users).set({ schoolId: defaultSchoolId }).where(eq(users.id, user.id))

        console.log(`✅ Fixed ${user.email}: ${user.schoolId} → ${defaultSchoolId}`)
        fixedCount++
      } catch (error) {
        console.log(
          `❌ Failed to fix ${user.email}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    console.log("\n📊 SUMMARY:")
    console.log(`  - Users processed: ${allProblematicUsers.length}`)
    console.log(`  - Successfully fixed: ${fixedCount}`)
    console.log(`  - Failed: ${allProblematicUsers.length - fixedCount}`)

    if (fixedCount > 0) {
      console.log("\n🎉 School ID issues have been resolved!")
      console.log("\n📋 Next steps:")
      console.log("  1. Run the verification script again to confirm fixes")
      console.log("  2. Review API endpoints for school_id validation")
      console.log("  3. Implement proper school_id filtering in queries")
    }
  } catch (error) {
    console.error("❌ Error during fix process:", error)
    process.exit(1)
  }
}

// Run the fix
if (require.main === module) {
  fixSchoolIdIssues()
    .then(() => {
      console.log("\n✅ Fix process completed")
      process.exit(0)
    })
    .catch((error) => {
      console.error("❌ Fix process failed:", error)
      process.exit(1)
    })
}

export default fixSchoolIdIssues
