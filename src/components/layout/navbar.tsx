"use client"
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { HeartPulse, Menu, X } from "lucide-react"
import Image from "next/image"

import Link from "next/link"
import React from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { site } from "@/config/site"
import { ModeToggle } from "./mode-toggle"

// Removed route and feature lists as navigation is simplified

export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className="sticky top-4 z-50 mx-auto w-[95%] max-w-7xl px-4">
      <nav className="rounded-2xl border-2 border-surface-2 bg-surface-1/80 shadow-lg backdrop-blur-xl shadow-medical-blue/10">
        <div className="flex items-center justify-between px-6 py-4 lg:px-8">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3 font-bold transition-all duration-300 hover:scale-105">
            <Image 
              src="/logo-medstint.svg"
              alt="MedStint Logo" 
              width={40} 
              height={40} 
              className="h-10 w-10"
            />
            <h3 className="font-bold text-2xl lg:text-3xl bg-gradient-to-r from-medical-blue to-medical-blue-dark bg-clip-text text-transparent">
              {site.name}
            </h3>
          </Link>

          {/* Spacer for centered logo */}
          <div className="flex-1" />

          {/* Desktop Actions */}
          <div className="hidden items-center gap-3 lg:flex">
            <ModeToggle />

            <SignedOut>
              <div className="flex items-center gap-3">
                <Button asChild size="default" variant="outline" className="rounded-xl border-2">
                  <Link href="/auth/sign-in?redirectTo=/dashboard">Sign In</Link>
                </Button>
                <Button asChild size="default" variant="default" className="rounded-xl">
                  <Link href="/auth/sign-up?redirectTo=/dashboard">Get Started</Link>
                </Button>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <Button asChild size="default" variant="outline" className="rounded-xl border-2">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <ModeToggle />
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border-2 border-input bg-background h-12 w-12 text-sm font-medium ring-offset-background transition-colors hover:bg-medical-blue-light hover:text-medical-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Toggle navigation menu"
                aria-expanded={isOpen}
                aria-controls="mobile-menu-sheet"
              >
                {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </SheetTrigger>

              <SheetContent
                side="right"
                id="mobile-menu-sheet"
                className="w-full max-w-sm border-2 border-surface-2 bg-surface-1/95 backdrop-blur-xl rounded-l-2xl"
              >
                <div className="flex h-full flex-col">
                  <SheetHeader className="pb-6">
                    <SheetTitle>
                      <Link
                        href="/"
                        className="flex items-center gap-3"
                        onClick={() => setIsOpen(false)}
                      >
                        <Image 
                          src="/logo-medstint.svg"
                          alt="MedStint Logo" 
                          width={40} 
                          height={40} 
                          className="h-10 w-10"
                        />
                        <span className="font-bold text-xl bg-gradient-to-r from-medical-blue to-medical-blue-dark bg-clip-text text-transparent">
                          {site.name}
                        </span>
                      </Link>
                    </SheetTitle>
                  </SheetHeader>

                  <Separator className="mb-6 border-surface-2" />

                  {/* Mobile Content - Enhanced */}
                  <div className="flex flex-1 flex-col justify-center text-center">
                    <div className="space-y-6">
                      <div className="text-muted-foreground">
                        <h4 className="font-semibold text-lg mb-2">Clinical Education Management</h4>
                        <p className="text-sm leading-relaxed">
                          Streamline your medical education journey with comprehensive tools for rotations, 
                          evaluations, and progress tracking.
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl bg-medical-blue-light/20 p-4 border border-medical-blue/20">
                            <HeartPulse className="h-8 w-8 text-medical-blue mx-auto mb-2" />
                            <p className="text-sm font-medium">Clinical Rotations</p>
                          </div>
                        <div className="rounded-xl bg-healthcare-green-light/20 p-4 border border-healthcare-green/20">
                          <div className="h-8 w-8 bg-healthcare-green rounded-lg mx-auto mb-2 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">A+</span>
                          </div>
                          <p className="text-sm font-medium">Evaluations</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <SheetFooter className="flex-row gap-3 border-t-2 border-surface-2 pt-6">
                    <SignedOut>
                      <div className="flex w-full flex-col gap-3">
                        <Button
                          asChild
                          variant="outline"
                          size="lg"
                          className="w-full rounded-xl border-2"
                        >
                          <Link href="/auth/sign-in?redirectTo=/dashboard" onClick={() => setIsOpen(false)}>Sign In</Link>
                        </Button>
                        <Button
                          asChild
                          variant="default"
                          size="lg"
                          className="w-full rounded-xl"
                        >
                          <Link href="/auth/sign-up?redirectTo=/dashboard" onClick={() => setIsOpen(false)}>Get Started</Link>
                        </Button>
                      </div>
                    </SignedOut>
                    <SignedIn>
                      <div className="flex w-full flex-col gap-3">
                        <Button
                          asChild
                          variant="outline"
                          className="w-full"
                        >
                          <Link href="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</Link>
                        </Button>
                        <div className="flex justify-end pt-2">
                          <UserButton afterSignOutUrl="/" />
                        </div>
                      </div>
                    </SignedIn>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </div>
  )
}
