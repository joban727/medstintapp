import "dotenv/config";
import { db } from "../src/database/connection-pool";
import { users } from "../src/database/schema";
import { eq } from "drizzle-orm";

async function checkAdminStatus() {
    console.log("Checking admin user status...");
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, "admin@test.com"))
        .limit(1);

    if (!user) {
        console.log("Admin user not found.");
    } else {
        console.log(`User: ${user.email}`);
        console.log(`Role: ${user.role}`);
        console.log(`OnboardingCompleted: ${user.onboardingCompleted}`);
        console.log(`SchoolId: ${user.schoolId}`);
    }
    process.exit(0);
}

checkAdminStatus();
