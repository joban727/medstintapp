"use client"

import { useState } from "react"
import {
  Search,
  CheckCircle,
  XCircle,
  Shield,
  MessageSquare,
  Database,
  FileText,
  Cloud,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

interface Integration {
  id: string
  name: string
  description: string
  category: "auth" | "communication" | "ehr" | "storage" | "analytics"
  icon: React.ReactNode
  status: "connected" | "disconnected" | "pending"
  isPopular?: boolean
}

const MOCK_INTEGRATIONS: Integration[] = [
  {
    id: "google",
    name: "Google Workspace",
    description: "Sync calendars, contacts, and drive files.",
    category: "auth",
    icon: <Shield className="h-8 w-8 text-blue-500" />,
    status: "connected",
    isPopular: true,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive notifications and updates in your Slack channels.",
    category: "communication",
    icon: <MessageSquare className="h-8 w-8 text-purple-500" />,
    status: "disconnected",
    isPopular: true,
  },
  {
    id: "epic",
    name: "Epic Systems",
    description: "Connect with Epic EHR for seamless patient data exchange.",
    category: "ehr",
    icon: <Database className="h-8 w-8 text-red-500" />,
    status: "disconnected",
  },
  {
    id: "cerner",
    name: "Oracle Cerner",
    description: "Integration with Cerner Millennium EHR platform.",
    category: "ehr",
    icon: <Database className="h-8 w-8 text-blue-600" />,
    status: "disconnected",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Store and share documents securely.",
    category: "storage",
    icon: <FileText className="h-8 w-8 text-blue-400" />,
    status: "disconnected",
  },
  {
    id: "onedrive",
    name: "OneDrive",
    description: "Microsoft OneDrive for Business integration.",
    category: "storage",
    icon: <Cloud className="h-8 w-8 text-blue-700" />,
    status: "connected",
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Sync emails and calendar events.",
    category: "communication",
    icon: <Mail className="h-8 w-8 text-blue-500" />,
    status: "connected",
  },
]

export function IntegrationsClient() {
  const [integrations, setIntegrations] = useState(MOCK_INTEGRATIONS)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const handleToggle = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) => {
        if (integration.id === id) {
          const newStatus = integration.status === "connected" ? "disconnected" : "connected"
          toast.success(
            `${integration.name} ${newStatus === "connected" ? "connected" : "disconnected"}`
          )
          return { ...integration, status: newStatus }
        }
        return integration
      })
    )
  }

  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch =
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || integration.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={selectedCategory === "auth" ? "default" : "outline"}
            onClick={() => setSelectedCategory("auth")}
            size="sm"
          >
            Auth & Identity
          </Button>
          <Button
            variant={selectedCategory === "communication" ? "default" : "outline"}
            onClick={() => setSelectedCategory("communication")}
            size="sm"
          >
            Communication
          </Button>
          <Button
            variant={selectedCategory === "ehr" ? "default" : "outline"}
            onClick={() => setSelectedCategory("ehr")}
            size="sm"
          >
            EHR / EMR
          </Button>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredIntegrations.map((integration) => (
          <Card key={integration.id} className="flex flex-col">
            <CardHeader className="flex-row gap-4 items-start space-y-0">
              <div className="p-2 bg-muted rounded-lg">{integration.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                  {integration.isPopular && (
                    <Badge variant="secondary" className="text-xs">
                      Popular
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  {integration.category.charAt(0).toUpperCase() + integration.category.slice(1)}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t pt-4 bg-muted/20">
              <div className="flex items-center gap-2 text-sm">
                {integration.status === "connected" ? (
                  <span className="flex items-center text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4 mr-1" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center text-muted-foreground">
                    <XCircle className="h-4 w-4 mr-1" /> Disconnected
                  </span>
                )}
              </div>
              <Switch
                checked={integration.status === "connected"}
                onCheckedChange={() => handleToggle(integration.id)}
              />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
