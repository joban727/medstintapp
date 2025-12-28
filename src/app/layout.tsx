import type { ReactNode } from "react"
import type { Viewport } from "next"
import { Providers } from "./providers"
import "@/styles/globals.css"
export const dynamic = "force-dynamic"

import { Roboto_Flex } from "next/font/google"

const roboto = Roboto_Flex({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <title>MedStint - Clinical Education Management</title>
      </head>
      <body className={`flex min-h-svh flex-col antialiased ${roboto.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
