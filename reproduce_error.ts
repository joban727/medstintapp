
import { getUserById } from "./src/lib/rbac-middleware"
import { db } from "./src/database/connection-pool"

async function main() {
    try {
        console.log("Attempting to fetch user...")
        const user = await getUserById("user_32nJTAmrWeeUpbqTE0tnBn1uuAd")
        console.log("User fetched:", user)
    } catch (error) {
        console.error("Error fetching user:", error)
    } finally {
        process.exit(0)
    }
}

main()
