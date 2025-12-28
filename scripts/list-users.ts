import "dotenv/config";
import { db } from "../src/database/connection-pool";
import { users } from "../src/database/schema";
import { desc } from "drizzle-orm";

async function listUsers() {
    console.log("Listing users...");
    const allUsers = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(10);

    allUsers.forEach((user) => {
        console.log(`ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Onboarding: ${user.onboardingCompleted}`);
    });

    process.exit(0);
}

listUsers();
