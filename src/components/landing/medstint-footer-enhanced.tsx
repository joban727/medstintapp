"use client"

import {
  Award,
  ExternalLink,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Shield,
  TrendingUp,
  Twitter,
  Youtube,
  Heart,
  Users,
  GraduationCap,
  Stethoscope,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTheme } from "next-themes"

const footerSections = [
  {
    title: "Platform",
    links: [
      { name: "Clinical Rotations", href: "/features/clinical-rotations" },
      { name: "Competency Assessment", href: "/features/competency" },
      { name: "Analytics", href: "/features/analytics" },
      { name: "Security", href: "/features/security" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { name: "Medical Schools", href: "/solutions/medical-schools" },
      { name: "Nursing Programs", href: "/solutions/nursing" },
      { name: "Hospital Systems", href: "/solutions/hospitals" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Documentation", href: "/docs" },
      { name: "Help Center", href: "/help" },
      { name: "Case Studies", href: "/case-studies" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About Us", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Contact", href: "/contact" },
    ],
  },
]

const socialLinks = [
  { name: "Twitter", icon: Twitter, href: "https://twitter.com/medstint" },
  { name: "LinkedIn", icon: Linkedin, href: "https://linkedin.com/company/medstint" },
  { name: "Instagram", icon: Instagram, href: "https://instagram.com/medstint" },
]

const quickLinks = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
  { name: "Support", href: "/support" },
]

const brandFeatures = [
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "HIPAA-compliant with enterprise-grade security",
  },
  {
    icon: Heart,
    title: "Student-Centered",
    description: "Designed for optimal learning outcomes",
  },
  {
    icon: Users,
    title: "Collaborative",
    description: "Connect students, preceptors, and administrators",
  },
  {
    icon: GraduationCap,
    title: "Comprehensive",
    description: "Complete medical education management",
  },
]

export const MedStintFooterEnhanced = () => {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-cyan-900 to-teal-900 text-white">
      {/* Newsletter Section */}
      <div className="border-slate-700 border-b">
        <div className="container mx-auto px-4 py-12">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center justify-between gap-8 rounded-xl bg-slate-100 dark:bg-slate-800 p-8 md:flex-row">
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center gap-3 mb-4">
                  <Image 
                    src="/logo-medstint.svg"
                    alt="MedStint Logo" 
                    width={40} 
                    height={40} 
                    className="h-10 w-10"
                  />
                  <div>
                    <h3 className="font-bold text-xl text-slate-900 dark:text-white">MedStint Newsletter</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Stay connected with medical education innovation</p>
                  </div>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Get the latest insights on medical education technology, best practices, and industry trends delivered to your inbox.
                </p>
              </div>
              <div className="flex w-full max-w-sm gap-2 md:w-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:placeholder:text-slate-400"
                />
                <Button className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white hover:from-cyan-700 hover:to-teal-700 whitespace-nowrap">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-12">
            {/* Enhanced Brand Section */}
            <div className="lg:col-span-4">
              <div className="mb-6">
                <Link href="/" className="flex items-center gap-4">
                  <Image 
                    src="/logo-medstint.svg"
                    alt="MedStint Logo" 
                    width={48} 
                    height={48} 
                    className="h-12 w-12"
                  />
                  <div>
                    <h4 className="font-bold text-2xl bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                      MedStint
                    </h4>
                    <p className="text-slate-400 text-sm font-medium">Medical Education Management</p>
                    <p className="text-cyan-400 text-xs font-semibold">Empowering Healthcare Education Excellence</p>
                  </div>
                </Link>
              </div>

              <p className="mb-6 text-slate-300 leading-relaxed">
                <strong className="text-white">Transforming medical education through innovation and excellence.</strong> 
                Our comprehensive platform streamlines clinical rotations, competency tracking, and student management 
                for healthcare institutions worldwide.
              </p>

              {/* Mission Statement */}
              <div className="mb-8 rounded-lg bg-slate-800/50 p-4 border border-slate-700">
                <h5 className="font-semibold text-cyan-400 mb-2">Our Mission</h5>
                <p className="text-slate-300 text-sm">
                  To empower healthcare education institutions with cutting-edge technology that enhances 
                  learning outcomes, improves operational efficiency, and ensures student success.
                </p>
              </div>

              {/* Contact Info */}
              <div className="mb-8 space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-300 hover:text-white transition-colors">
                    <a href="mailto:contact@medstint.com">contact@medstint.com</a>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-300">+1 (855) MED-STINT</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-300">Healthcare Education Hub, USA</span>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-3">
                {socialLinks.map((social) => (
                  <Link
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-800 to-teal-800 text-cyan-300 transition-all duration-300 hover:from-cyan-700 hover:to-teal-700 hover:text-white hover:scale-110"
                    aria-label={`Follow us on ${social.name}`}
                  >
                    <social.icon className="h-5 w-5" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Navigation Sections */}
            <div className="lg:col-span-8">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {footerSections.map((section) => (
                  <div key={section.title}>
                    <h5 className="mb-4 font-semibold text-lg text-white border-l-2 border-cyan-500 pl-3">
                      {section.title}
                    </h5>
                    <ul className="space-y-3">
                      {section.links.map((link) => (
                        <li key={link.name}>
                          <Link
                            href={link.href}
                            className="flex items-center text-slate-300 transition-colors hover:text-white hover:underline group"
                          >
                            <span className="w-2 h-2 bg-cyan-500 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                            {link.name}
                            <ExternalLink className="ml-1 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Enhanced Features Cards */}
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {brandFeatures.map((feature, index) => (
              <Card key={index} className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-700 to-teal-700">
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h6 className="mb-2 font-semibold text-white">{feature.title}</h6>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-slate-700 border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="flex items-center gap-4">
                <Image 
                  src="/logo-medstint.svg"
                  alt="MedStint" 
                  width={24} 
                  height={24} 
                  className="h-6 w-6"
                />
                <p className="text-slate-400 text-sm">
                  © {new Date().getFullYear()} MedStint. All rights reserved.
                </p>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-400 text-sm">Trusted by Healthcare Institutions</span>
                </div>
                <div className="flex gap-4">
                  {quickLinks.map((link) => (
                    <Link
                      key={link.name}
                      href={link.href}
                      className="text-slate-400 text-sm hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Brand Tagline */}
            <div className="mt-4 text-center">
              <p className="text-cyan-400 text-sm font-medium">
                "Transforming Medical Education Through Innovation & Excellence"
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
