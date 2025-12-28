import type { Metadata } from "next"
import { PortalEntry } from "@/components/landing/portal-entry"
import { site } from "../../config/site"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  openGraph: {
    title: site.name,
    description: site.description,
    images: [
      {
        url: site.ogImage,
        width: 1200,
        height: 630,
        alt: site.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
    images: [site.ogImage],
  },
}

export default async function MedStintHomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen bg-background">
      <PortalEntry />
    </main>
  )
}
