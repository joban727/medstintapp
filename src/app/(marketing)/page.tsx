import type { Metadata } from "next"
import { MedStintFeaturesEnhanced } from "@/components/landing/medstint-features-enhanced"
import { MedStintFooterEnhanced } from "@/components/landing/medstint-footer-enhanced"
import { MedStintHeroEnhanced } from "@/components/landing/medstint-hero-enhanced"
import { MedStintStatsEnhanced } from "@/components/landing/medstint-stats-enhanced"
import { MedStintUserRolesEnhanced } from "@/components/landing/medstint-user-roles-enhanced"
import { site } from "../../config/site"

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

export default function MedStintHomePage() {
  return (
    <div className="min-h-screen">
      <MedStintHeroEnhanced />
      <MedStintFeaturesEnhanced />
      <MedStintUserRolesEnhanced />
      <MedStintStatsEnhanced />
      <MedStintFooterEnhanced />
    </div>
  )
}
