"use client"

import { ArrowRight, Lock } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { site } from "@/config/site"

export const HeroSection = () => {
  const { theme } = useTheme()
  return (
    <section className="container mx-auto w-full px-4">
      <div className="grid place-items-center gap-8 py-20 md:py-32 lg:max-w-screen-xl">
        <div className="gap-8 text-center">
          <Badge variant="outline" className="rounded-lgxl py-2 text-sm">
            <span className="mr-2 text-primary">
              <Badge>New</Badge>
            </span>
            <span> Launch your SaaS now! </span>
          </Badge>
          <div className="mx-auto max-w-screen-md text-center font-bold text-4xl md:text-6xl">
            <h1>
              Experience the
              <span className="bg-gradient-to-r from-[#da5319] to-primary bg-clip-text px-2 text-transparent">
                {" "}
                Indie SaaS{" "}
              </span>
              Boilerplate
            </h1>
          </div>
          <p className="mx-auto max-w-screen-sm text-muted-foreground text-xl">
            {`A complete SaaS starter with authentication, beautiful UI components, and everything you need to launch your platform quickly and efficiently.`}
          </p>
          <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center md:gap-4 md:gap-0">
            <Button asChild size="lg" className="group/arrow rounded-full">
              <Link href="/auth/sign-up">
                <div className="flex items-center">
                  Get Started
                  <ArrowRight className="ml-2 size-5 transition-transform duration-200 group-hover/arrow:translate-x-1" />
                </div>
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link href="/auth/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
        <div className="group relative mt-14">
          <div className="lg:-top-8 -translate-x-1/2 absolute top-2 left-1/2 mx-auto h-24 w-[90%] transform rounded-full bg-primary/50 blur-3xl lg:h-80" />
          {/* Browser Navigation Bar */}
          <div className="relative mx-auto w-full md:w-[1200px]">
            <div className="flex h-10 items-center rounded-t-lg bg-sidebar px-4">
              {/* Traffic Light Buttons */}
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-warning" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              {/* URL Bar */}
              <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 w-1/3">
                <div className="flex h-6 items-center justify-center rounded-md bg-secondary/50 px-3">
                  <Lock className="mr-1.5 size-3 text-muted-foreground" />
                  <div className="text-muted-foreground text-xs">{site.url}</div>
                </div>
              </div>
            </div>
          </div>
          <Image
            width={1200}
            height={1200}
            className="relative mx-auto flex w-full items-center rounded-b-lg "
            src={theme === "light" ? "/dash-light.png" : "/dash.png"}
            alt="dashboard"
          />
          <div className="absolute bottom-0 left-0 h-20 w-full rounded-lg bg-gradient-to-b from-background/0 via-background/50 to-background md:h-28" />
        </div>
      </div>
    </section>
  )
}
