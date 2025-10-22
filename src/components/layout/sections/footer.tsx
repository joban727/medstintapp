"use client"

import { useId } from "react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { site } from "@/config/site"
import { useTheme } from "next-themes"

const footerNavs = [
  {
    label: "Product",
    items: [
      { href: "/features", name: "Features" },
      { href: "/pricing", name: "Pricing" },
      { href: "/integrations", name: "Integrations" },
      { href: "/changelog", name: "Changelog" },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/about", name: "About" },
      { href: "/careers", name: "Careers" },
      { href: "/blog", name: "Blog" },
      { href: "/contact", name: "Contact" },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/docs", name: "Documentation" },
      { href: "/help", name: "Help Center" },
      { href: "/community", name: "Community" },
      { href: "/status", name: "Status" },
    ],
  },
  {
    label: "Legal",
    items: [
      { href: "/privacy", name: "Privacy" },
      { href: "/terms", name: "Terms" },
      { href: "/security", name: "Security" },
      { href: "/compliance", name: "Compliance" },
    ],
  },
]

const socialLinks = [
  {
    name: "Twitter",
    href: site.links.twitter,
    icon: (props: any) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
      </svg>
    ),
  },
  {
    name: "LinkedIn",
    href: site.links.linkedin,
    icon: (props: any) => (
      <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
]

export const FooterSection = () => {
  const footerId = useId()
  // Use consistent logo to prevent hydration mismatch
  const logoSrc = "/logo-medstint.svg"

  return (
    <footer id={`footer-${footerId}`}>
      <div className="mx-auto max-w-7xl pt-16 pb-0 lg:pb-16">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 shadow-xl backdrop-blur-sm">
          <div className="relative p-8 lg:p-12">
            {/* Main Footer Content */}
            <div className="space-y-8 lg:space-y-0">
              {/* Desktop Layout: Side by side */}
              <div className="hidden gap-12 lg:grid lg:grid-cols-6">
                {/* Brand Section */}
                <div className="col-span-2">
                  <Link href="/" className="group mb-4 flex gap-2 font-bold">
                    <div className="relative">
                      <Image src={logoSrc} alt={site.name} width={30} height={30} />
                    </div>
                    <h3 className="font-bold text-2xl">{site.name}</h3>
                  </Link>
                  <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
                    Streamline clinical education with comprehensive student tracking, rotation
                    management, and competency assessments for medical institutions.
                  </p>
                  <div className="flex gap-4">
                    {socialLinks.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <span className="sr-only">{item.name}</span>
                        <item.icon className="h-5 w-5" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="col-span-4 grid grid-cols-4 gap-8">
                  {footerNavs.map((nav) => (
                    <div key={nav.label}>
                      <h4 className="mb-4 font-semibold text-foreground text-sm">{nav.label}</h4>
                      <ul className="space-y-3">
                        {nav.items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className="text-muted-foreground text-sm hover:text-foreground"
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Layout: Stacked */}
              <div className="space-y-8 lg:hidden">
                {/* Brand Section */}
                <div>
                  <Link href="/" className="group mb-4 flex gap-2 font-bold">
                    <div className="relative">
                      <Image src={logoSrc} alt={site.name} width={30} height={30} />
                    </div>
                    <h3 className="font-bold text-2xl">{site.name}</h3>
                  </Link>
                  <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
                    Streamline clinical education with comprehensive student tracking, rotation
                    management, and competency assessments for medical institutions.
                  </p>
                  <div className="flex gap-4">
                    {socialLinks.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <span className="sr-only">{item.name}</span>
                        <item.icon className="h-5 w-5" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="grid grid-cols-2 gap-8">
                  {footerNavs.map((nav) => (
                    <div key={nav.label}>
                      <h4 className="mb-4 font-semibold text-foreground text-sm">{nav.label}</h4>
                      <ul className="space-y-3">
                        {nav.items.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              className="text-muted-foreground text-sm hover:text-foreground"
                            >
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            {/* Bottom Section */}
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-4">
                <Badge variant="secondary" className="text-xs">
                  HIPAA Compliant
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  SOC 2 Type II
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                © {new Date().getFullYear()} {site.name}. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
