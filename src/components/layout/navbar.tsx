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
    <div className="sticky top-0 z-50 mx-auto w-full max-w-7xl px-2 pt-2">
      <nav className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-md shadow-primary/5">
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center font-semibold transition-colors duration-200"
          >
            <Image
              src="/logo-medstint.svg"
              alt="MedStint Logo"
              width={140}
              height={40}
              className="h-8 sm:h-10"
            />
          </Link>

          {/* Spacer for centered logo */}
          <div className="flex-1" />

          {/* Desktop Actions */}
          <div className="hidden items-center gap-2 sm:gap-3 lg:flex">
            <ModeToggle />
            <SignedOut>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link href="/auth/sign-in?redirectTo=/dashboard">Sign In</Link>
                </Button>
                <Button asChild size="sm" variant="default" className="rounded-xl">
                  <Link href="/auth/sign-up?redirectTo=/dashboard">Get Started</Link>
                </Button>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button asChild size="sm" variant="outline" className="rounded-xl">
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
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border border-input bg-background h-10 w-10 sm:h-12 sm:w-12 text-sm font-medium ring-offset-background transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Toggle navigation menu"
                aria-expanded={isOpen}
                aria-controls="mobile-menu-sheet"
              >
                {isOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </SheetTrigger>
              <SheetContent
                side="right"
                id="mobile-menu-sheet"
                className="w-full max-w-sm border border-border bg-background/90 backdrop-blur-md rounded-l-xl"
              >
                <div className="flex h-full flex-col">
                  <SheetHeader className="pb-6">
                    <SheetTitle>
                      <Link href="/" className="flex items-center" onClick={() => setIsOpen(false)}>
                        <Image
                          src="/logo-medstint.svg"
                          alt="MedStint Logo"
                          width={140}
                          height={40}
                          className="h-10"
                        />
                      </Link>
                    </SheetTitle>
                  </SheetHeader>
                  <Separator className="mb-6 border-border" />
                  <div className="flex flex-1 flex-col justify-center">
                    <ul className="space-y-3">
                      <li>
                        <Link href="/" onClick={() => setIsOpen(false)} className="text-foreground">
                          Home
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/terms"
                          onClick={() => setIsOpen(false)}
                          className="text-foreground"
                        >
                          Terms
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/privacy"
                          onClick={() => setIsOpen(false)}
                          className="text-foreground"
                        >
                          Privacy
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* Mobile Actions */}
                  <SheetFooter className="flex-row gap-3 border-t border-border pt-6">
                    <SignedOut>
                      <div className="flex w-full flex-col gap-3">
                        <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
                          <Link
                            href="/auth/sign-in?redirectTo=/dashboard"
                            onClick={() => setIsOpen(false)}
                          >
                            Sign In
                          </Link>
                        </Button>
                        <Button asChild variant="default" size="lg" className="w-full rounded-xl">
                          <Link
                            href="/auth/sign-up?redirectTo=/dashboard"
                            onClick={() => setIsOpen(false)}
                          >
                            Get Started
                          </Link>
                        </Button>
                      </div>
                    </SignedOut>
                    <SignedIn>
                      <div className="flex w-full flex-col gap-3">
                        <Button asChild variant="outline" className="w-full rounded-xl">
                          <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                            Dashboard
                          </Link>
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
