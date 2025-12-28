
import { db } from "../src/database/db";
import { cohorts, programs } from "../src/database/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Checking Programs...");
    const allPrograms = await db.select().from(programs);
    console.log(`Found ${allPrograms.length} programs:`);
    allPrograms.forEach(p => console.log(`- [${p.id}] ${p.name}`));

    console.log("\nChecking Cohorts...");
    const allCohorts = await db.select().from(cohorts);
    console.log(`Found ${allCohorts.length} cohorts:`);
    allCohorts.forEach(c => console.log(`- [${c.id}] ${c.name} (Program ID: ${c.programId})`));

    if (allPrograms.length > 0 && allCohorts.length === 0) {
        console.log("\nWARNING: Programs exist but no cohorts found. This explains the empty dropdown.");
    } else if (allCohorts.length > 0) {
        console.log("\nCohorts exist. Checking linkage...");
        const orphaned = allCohorts.filter(c => !allPrograms.find(p => p.id === c.programId));
        if (orphaned.length > 0) {
            console.log(`WARNING: ${orphaned.length} cohorts are not linked to valid programs.`);
        } else {
            console.log("All cohorts are linked to valid programs.");
        }
    }
}

main().catch(console.error).finally(() => process.exit(0));
