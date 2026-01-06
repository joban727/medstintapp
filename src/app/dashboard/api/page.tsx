"use client"

import { Copy, Plus, Trash2 } from "lucide-react"
import { useId } from "react"
import { PageHeader } from "../../../components/layout/page-header"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"

export default function APIKeysSettingsPage() {
  const apiKeyId = useId()
  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage your API keys for accessing the MedStint API."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API Access</CardTitle>
          <CardDescription>
            Generate keys to access the MedStint API programmatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={apiKeyId}>Your API Key</Label>
              <div className="mt-1 flex items-center space-x-2">
                <Input
                  id={apiKeyId}
                  type="password"
                  value="sk-1234567890abcdef"
                  readOnly
                  className="font-mono"
                />
                <Button type="button" variant="outline" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <Button type="button" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Generate New API Key
          </Button>

          <p className="text-muted-foreground">
            Manage your API keys and access tokens for external integrations with MedStint.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
