import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, CheckCircle2, Circle } from "lucide-react"
import Link from "next/link"

export function GettingStartedCard() {
  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/50 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
            <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          Get Started with MedStint
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Welcome to your new school dashboard! Use the setup wizard to easily onboard students and
          clinical sites.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-2 text-sm bg-white/50 dark:bg-slate-800/50 p-2 rounded border border-blue-100 dark:border-blue-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground line-through">Create Account</span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-white dark:bg-slate-800 p-2 rounded border border-blue-200 dark:border-blue-800 shadow-sm">
            <Circle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900 dark:text-blue-100">Add Students</span>
          </div>
          <div className="flex items-center gap-2 text-sm bg-white/50 dark:bg-slate-800/50 p-2 rounded border border-blue-100 dark:border-blue-900">
            <Circle className="h-4 w-4 text-blue-400" />
            <span className="text-blue-800 dark:text-blue-200">Create Rotations</span>
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard/school-admin/setup">
              Go to Setup Wizard <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950">
            <Link href="/dashboard/school-admin/programs">View Programs</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
