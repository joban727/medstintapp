import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import type { NextRequest } from "next/server"
import { Webhook } from "svix"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"

import type { UserRole } from "@/types"
type ClerkWebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses: Array<{
      email_address: string
      id: string
    }>
    first_name?: string
    last_name?: string
    image_url?: string
    created_at: number
    updated_at: number
  }
}

export async function POST(req: NextRequest) {
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.text()
  const _body = JSON.parse(payload)

  // Validate webhook secret is configured
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured")
    return new Response("Webhook not configured", { status: 500 })
  }

  // Create a new Svix instance with your secret.
  const wh = new Webhook(webhookSecret)

  let evt: ClerkWebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkWebhookEvent
  } catch (err) {
    console.error("Error verifying webhook:", err)
    return new Response("Error occured", {
      status: 400,
    })
  }

  // Handle the webhook
  const { type, data } = evt
  const userId = data.id
  const email = data.email_addresses[0]?.email_address
  const firstName = data.first_name || ""
  const lastName = data.last_name || ""
  const name = `${firstName} ${lastName}`.trim() || email?.split("@")[0] || "User"
  const imageUrl = data.image_url

  try {
    if (!email) {
      console.error("No email address found in webhook data")
      return new Response("Invalid webhook data - missing email", { status: 400 })
    }

    switch (type) {
      case "user.created":
        // Create user in database when they sign up
        await db.insert(users).values({
          id: userId,
          email: email,
          name: name,
          image: imageUrl,
          emailVerified: true,
          role: "STUDENT" as UserRole, // Default role
          isActive: true,
          onboardingCompleted: false,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        })
        // User created successfully
        break

      case "user.updated":
        // Update user in database when they update their profile
        await db
          .update(users)
          .set({
            email: email,
            name: name,
            image: imageUrl,
            updatedAt: new Date(data.updated_at),
          })
          .where(eq(users.id, userId))
        // User updated successfully
        break

      case "user.deleted":
        // Soft delete user (set inactive) when they delete their account
        await db
          .update(users)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))

        // Revoke all Clerk sessions for this user to prevent access after deletion
        try {
          const clerkSecretKey = process.env.CLERK_SECRET_KEY
          if (clerkSecretKey) {
            await fetch(`https://api.clerk.com/v1/users/${userId}/sessions`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
                "Content-Type": "application/json",
              },
            })
            console.log(`Revoked sessions for deleted user ${userId}`)
          }
        } catch (sessionError) {
          console.error(`Failed to revoke sessions for user ${userId}:`, sessionError)
          // Continue - user is already soft-deleted, session revocation is best-effort
        }
        break

      default:
      // Unhandled webhook type
    }
  } catch (error) {
    console.error(`Error handling webhook ${type}:`, error)
    return new Response("Error processing webhook", { status: 500 })
  }

  return new Response("Webhook processed successfully", { status: 200 })
}

