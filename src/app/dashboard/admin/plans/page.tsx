import { getAllPlans } from "@/lib/payments/plans-service"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Check, X } from "lucide-react"
import Link from "next/link"

export default async function AdminPlansPage() {
  const plans = await getAllPlans()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Plans Management" description="Manage subscription plans and pricing." />
        <Link href="/dashboard/admin/plans/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={plan.type === "SCHOOL_SEAT" ? "outline" : "default"}>
                  {plan.type === "SCHOOL_SEAT" ? "School Seat" : "Student"}
                </Badge>
                {plan.isActive ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${plan.price.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground capitalize">Billed {plan.interval}ly</p>
              <div className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center text-sm">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">ID: {plan.stripePriceId}</div>
            </CardContent>
            <CardFooter>
              <Link href={`/dashboard/admin/plans/${plan.id}`} className="w-full">
                <Button variant="outline" className="w-full">
                  Edit Plan
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-8 text-center border rounded-lg border-dashed">
            <p className="text-muted-foreground mb-4">No plans found.</p>
            <Link href="/dashboard/admin/plans/new">
              <Button variant="outline">Create your first plan</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
