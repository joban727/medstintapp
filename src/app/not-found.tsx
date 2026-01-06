import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center text-center overflow-hidden">
      <DashboardBackground />
      <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm p-12 flex flex-col items-center max-w-lg w-full mx-4">
        <div className="mb-6 rounded-full bg-white/10 p-6 backdrop-blur-sm">
          <FileQuestion className="h-12 w-12 text-white/80" />
        </div>
        <h1 className="mb-2 font-bold text-4xl tracking-tight text-white">Page Not Found</h1>
        <p className="mb-8 text-[var(--text-tertiary)]">
          Sorry, we couldn't find the page you're looking for. It might have been moved, deleted, or
          never existed.
        </p>
        <div className="flex gap-4">
          <Button asChild variant="glass-theme">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild variant="glass">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
