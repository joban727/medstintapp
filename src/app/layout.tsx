import type { ReactNode } from "react"
import { Providers } from "./providers"
import "@/styles/globals.css"

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" sizes="any" />
      </head>
      <body className="flex min-h-svh flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
