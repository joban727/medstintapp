/**
 * Script to backfill existing users' approvalStatus to 'APPROVED'
 * Run with: npx tsx scripts/backfill-approval-status.ts
 */

import "dotenv/config";
import { db } from "../src/database/db";
import { users } from "../src/database/schema";
import { sql, isNull, or, ne } from "drizzle-orm";

async function backfillApprovalStatus() {
    console.log("Starting approval status backfill...");

    try {
        // Update all users where approvalStatus is NULL or PENDING (for existing users)
        // to APPROVED, but only if they have completed onboarding
        const result = await db
            .update(users)
            .set({ approvalStatus: "APPROVED" })
            .where(
                or(
                    isNull(users.approvalStatus),
                    sql`${users.onboardingCompleted} = true AND ${users.approvalStatus} = 'PENDING'`
                )
            );

        console.log("Backfill complete!");
        console.log("Users updated to APPROVED status.");

        // Get count of remaining pending users
        const pendingUsers = await db
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(sql`${users.approvalStatus} = 'PENDING'`);

        console.log(`Remaining PENDING users: ${pendingUsers[0]?.count || 0}`);

        process.exit(0);
    } catch (error) {
        console.error("Error during backfill:", error);
        process.exit(1);
    }
}

backfillApprovalStatus();
