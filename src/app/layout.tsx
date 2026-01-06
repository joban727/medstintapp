import type { ReactNode } from "react"
import type { Viewport } from "next"
import { Providers } from "./providers"
import "@/styles/globals.css"
import { ThemeScript } from "@/components/theme-script"
import { HydrationFix } from "@/components/hydration-fix"

export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>MedStint - Clinical Education Management</title>
        {/* Google Sans Flex - Official Google Font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Manrope:wght@200..800&family=Outfit:wght@100..900&family=Roboto:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-svh flex-col antialiased font-sans" suppressHydrationWarning>
        <HydrationFix />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
