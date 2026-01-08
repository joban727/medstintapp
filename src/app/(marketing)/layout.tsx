import { LenisProvider } from "@/components/providers/lenis-provider"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <LenisProvider>{children}</LenisProvider>
}
