import { config } from "dotenv"

// Load environment variables from .env files
config({ path: ".env.local" })
config({ path: ".env" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required")
}

export default {
  out: "./migrations",
  schema: "src/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
}
