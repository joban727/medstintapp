import "dotenv/config";
import { db } from "../src/database/connection-pool";
import { users } from "../src/database/schema";
import { eq } from "drizzle-orm";

async function resetTestUser() {
    console.log("Finding admin user...");
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, "joban727@gmail.com"))
        .limit(1);

    if (!user) {
        console.error("No user found.");
        process.exit(1);
    }

    console.log(`Resetting user: ${user.email} (${user.id})`);

    // Reset user fields
    await db
        .update(users)
        .set({
            onboardingCompleted: false,
            role: null,
            schoolId: null,
            programId: null,
        })
        .where(eq(users.id, user.id));

    console.log("User reset successfully.");
    process.exit(0);
}

resetTestUser().catch((err) => {
    console.error("Error resetting user:", err);
    process.exit(1);
});
