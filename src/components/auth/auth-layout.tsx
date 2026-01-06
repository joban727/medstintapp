import { DashboardBackground } from "@/components/dashboard/dashboard-background"

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[var(--theme-bg-color)]">
      <DashboardBackground />
      <div className="relative z-10 w-full max-w-md p-4">{children}</div>
    </div>
  )
}
