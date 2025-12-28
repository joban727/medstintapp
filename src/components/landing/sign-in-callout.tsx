import Link from "next/link"
import { Button } from "@/components/ui/button"

export const SignInCallout = () => {
  return (
    <section className="container mx-auto max-w-xl md:max-w-2xl lg:max-w-3xl 2xl:max-w-4xl 3xl:max-w-5xl px-4 py-10">
      <div className="rounded-xl border border-border bg-card p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-semibold text-foreground">
          Ready to get started?
        </h2>
        <p className="mt-2 text-muted-foreground text-base md:text-lg">
          Sign in to manage rotations, track competencies, and view analytics.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild className="rounded-xl">
            <Link href="/auth/sign-in">Sign In</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/auth/sign-up">Create Account</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
