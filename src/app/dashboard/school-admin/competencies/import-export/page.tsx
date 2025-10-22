"use client"

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileText,
  History,
  RefreshCw,
  Settings,
  Upload,
  X,
} from "lucide-react"
import { useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface ImportJob {
  id: string
  fileName: string
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  totalRecords: number
  processedRecords: number
  validRecords: number
  errorRecords: number
  startTime: string
  endTime?: string
  errors: ImportError[]
}

interface ImportError {
  row: number
  field: string
  message: string
  severity: "error" | "warning"
}

interface ExportJob {
  id: string
  name: string
  format: "csv" | "json" | "xlsx"
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  recordCount: number
  fileSize?: string
  createdAt: string
  downloadUrl?: string
}

interface Template {
  id: string
  name: string
  category: string
  version: string
  competencyCount: number
  selected: boolean
}

// TODO: Replace with actual API calls to fetch import/export jobs and templates
const mockImportJobs: ImportJob[] = [] // TODO: Fetch from API
const mockExportJobs: ExportJob[] = [] // TODO: Fetch from API
const mockTemplates: Template[] = [] // TODO: Fetch from API

export default function ImportExportCenterPage() {
  const [activeTab, setActiveTab] = useState("import")
  const [importJobs, _setImportJobs] = useState<ImportJob[]>(mockImportJobs)
  const [exportJobs, _setExportJobs] = useState<ExportJob[]>(mockExportJobs)
  const [templates, setTemplates] = useState<Template[]>(mockTemplates)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files?.[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleFiles = (_files: FileList) => {
    // Handle file upload logic here
    // Files to upload validation
  }

  const toggleTemplateSelection = (templateId: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, selected: !t.selected } : t))
    )
  }

  const selectAllTemplates = (selected: boolean) => {
    setTemplates((prev) => prev.map((t) => ({ ...t, selected })))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Import/Export Center</h1>
          <p className="text-muted-foreground">
            Bulk import and export competency templates and data
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            View History
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
          <TabsTrigger value="jobs">Jobs ({importJobs.length + exportJobs.length})</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <ImportTab
            dragActive={dragActive}
            handleDrag={handleDrag}
            handleDrop={handleDrop}
            fileInputRef={fileInputRef}
            handleFiles={handleFiles}
          />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <ExportTab
            templates={templates}
            toggleTemplateSelection={toggleTemplateSelection}
            selectAllTemplates={selectAllTemplates}
          />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <JobsTab importJobs={importJobs} exportJobs={exportJobs} />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <ValidationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ImportTab({
  dragActive,
  handleDrag,
  handleDrop,
  fileInputRef,
  handleFiles,
}: {
  dragActive: boolean
  handleDrag: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFiles: (files: FileList) => void
}) {
  const [importOptions, setImportOptions] = useState({
    skipDuplicates: true,
    validateOnly: false,
    updateExisting: false,
    createBackup: true,
  })

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Upload CSV, JSON, or Excel files containing competency templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className={`w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-medium">Drop files here or click to browse</h3>
            <p className="mb-4 text-muted-foreground text-sm">
              Supported formats: CSV, JSON, XLSX (Max 10MB per file)
            </p>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.json,.xlsx"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </button>
        </CardContent>
      </Card>

      {/* Import Options */}
      <Card>
        <CardHeader>
          <CardTitle>Import Options</CardTitle>
          <CardDescription>Configure how the import should be processed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="skipDuplicates"
                checked={importOptions.skipDuplicates}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, skipDuplicates: checked as boolean }))
                }
              />
              <Label htmlFor="skipDuplicates">Skip duplicate templates</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="validateOnly"
                checked={importOptions.validateOnly}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, validateOnly: checked as boolean }))
                }
              />
              <Label htmlFor="validateOnly">Validate only (don't import)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="updateExisting"
                checked={importOptions.updateExisting}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, updateExisting: checked as boolean }))
                }
              />
              <Label htmlFor="updateExisting">Update existing templates</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="createBackup"
                checked={importOptions.createBackup}
                onCheckedChange={(checked) =>
                  setImportOptions((prev) => ({ ...prev, createBackup: checked as boolean }))
                }
              />
              <Label htmlFor="createBackup">Create backup before import</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Import Templates</CardTitle>
          <CardDescription>
            Use pre-configured templates for common import scenarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <FileText className="h-6 w-6" />
              <span>LCME Standards</span>
              <span className="text-muted-foreground text-xs">
                Import LCME competency framework
              </span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <FileText className="h-6 w-6" />
              <span>ACGME Milestones</span>
              <span className="text-muted-foreground text-xs">
                Import ACGME milestone templates
              </span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4">
              <FileText className="h-6 w-6" />
              <span>Custom Template</span>
              <span className="text-muted-foreground text-xs">Upload your own template format</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ExportTab({
  templates,
  toggleTemplateSelection,
  selectAllTemplates,
}: {
  templates: Template[]
  toggleTemplateSelection: (id: string) => void
  selectAllTemplates: (selected: boolean) => void
}) {
  const [exportFormat, setExportFormat] = useState("xlsx")
  const [exportOptions, setExportOptions] = useState({
    includeRubrics: true,
    includeVersionHistory: false,
    includeDeploymentData: false,
    compressOutput: true,
  })

  const selectedCount = templates.filter((t) => t.selected).length
  const allSelected = selectedCount === templates.length
  const _someSelected = selectedCount > 0 && selectedCount < templates.length

  return (
    <div className="space-y-6">
      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
          <CardDescription>Configure what data to include in the export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="format">Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Export Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeRubrics"
                    checked={exportOptions.includeRubrics}
                    onCheckedChange={(checked) =>
                      setExportOptions((prev) => ({ ...prev, includeRubrics: checked as boolean }))
                    }
                  />
                  <Label htmlFor="includeRubrics" className="text-sm">
                    Include rubric criteria
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeVersionHistory"
                    checked={exportOptions.includeVersionHistory}
                    onCheckedChange={(checked) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeVersionHistory: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="includeVersionHistory" className="text-sm">
                    Include version history
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="includeDeploymentData"
                    checked={exportOptions.includeDeploymentData}
                    onCheckedChange={(checked) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeDeploymentData: checked as boolean,
                      }))
                    }
                  />
                  <Label htmlFor="includeDeploymentData" className="text-sm">
                    Include deployment data
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="compressOutput"
                    checked={exportOptions.compressOutput}
                    onCheckedChange={(checked) =>
                      setExportOptions((prev) => ({ ...prev, compressOutput: checked as boolean }))
                    }
                  />
                  <Label htmlFor="compressOutput" className="text-sm">
                    Compress output file
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Select Templates to Export</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {selectedCount} of {templates.length} selected
              </span>
              <Button variant="outline" size="sm" onClick={() => selectAllTemplates(!allSelected)}>
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>Choose which templates to include in the export</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center space-x-3 rounded-lg border p-3">
                <Checkbox
                  checked={template.selected}
                  onCheckedChange={() => toggleTemplateSelection(template.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{template.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {template.category} • v{template.version} • {template.competencyCount}{" "}
                    competencies
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Ready to Export</p>
              <p className="text-muted-foreground text-sm">
                {selectedCount} templates selected for export as {exportFormat.toUpperCase()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={selectedCount === 0}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button disabled={selectedCount === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function JobsTab({ importJobs, exportJobs }: { importJobs: ImportJob[]; exportJobs: ExportJob[] }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
      case "failed":
        return <X className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "processing":
        return "secondary"
      case "failed":
        return "destructive"
      case "pending":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      {/* Import Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Import Jobs</CardTitle>
          <CardDescription>Recent and ongoing import operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {importJobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.fileName}</p>
                      <p className="text-muted-foreground text-sm">
                        Started {new Date(job.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      getStatusColor(job.status) as
                        | "default"
                        | "secondary"
                        | "destructive"
                        | "outline"
                    }
                  >
                    {job.status}
                  </Badge>
                </div>

                {job.status === "processing" && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                <div className="grid gap-2 text-sm md:grid-cols-4">
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-medium">{job.totalRecords}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Processed: </span>
                    <span className="font-medium">{job.processedRecords}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Valid: </span>
                    <span className="font-medium text-green-600">{job.validRecords}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Errors: </span>
                    <span className="font-medium text-red-600">{job.errorRecords}</span>
                  </div>
                </div>

                {job.errors.length > 0 && (
                  <div className="mt-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          View Errors ({job.errors.length})
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Import Errors - {job.fileName}</DialogTitle>
                          <DialogDescription>
                            Review the errors encountered during import
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto">
                          <div className="space-y-2">
                            {job.errors.map((error, index) => (
                              <Alert
                                key={`error-${error.row}-${error.field}-${index}`}
                                variant={error.severity === "error" ? "destructive" : "default"}
                              >
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  <strong>
                                    Row {error.row}, Field "{error.field}":
                                  </strong>{" "}
                                  {error.message}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Export Jobs</CardTitle>
          <CardDescription>Recent and ongoing export operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {exportJobs.map((job) => (
              <div key={job.id} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {job.format.toUpperCase()} • Created{" "}
                        {new Date(job.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        getStatusColor(job.status) as
                          | "default"
                          | "secondary"
                          | "destructive"
                          | "outline"
                      }
                    >
                      {job.status}
                    </Badge>
                    {job.status === "completed" && job.downloadUrl && (
                      <Button size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>

                {job.status === "processing" && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span>{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Records: </span>
                    <span className="font-medium">{job.recordCount}</span>
                  </div>
                  {job.fileSize && (
                    <div>
                      <span className="text-muted-foreground">Size: </span>
                      <span className="font-medium">{job.fileSize}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ValidationTab() {
  const [validationRules, setValidationRules] = useState({
    requireUniqueNames: true,
    validateRubricCriteria: true,
    checkCategoryExists: true,
    enforceVersionFormat: true,
    validateCompetencyStructure: true,
  })

  return (
    <div className="space-y-6">
      {/* Validation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Rules</CardTitle>
          <CardDescription>Configure validation rules for import operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="requireUniqueNames">Require Unique Template Names</Label>
                <p className="text-muted-foreground text-sm">
                  Prevent duplicate template names within the same category
                </p>
              </div>
              <Checkbox
                id="requireUniqueNames"
                checked={validationRules.requireUniqueNames}
                onCheckedChange={(checked) =>
                  setValidationRules((prev) => ({
                    ...prev,
                    requireUniqueNames: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="validateRubricCriteria">Validate Rubric Criteria</Label>
                <p className="text-muted-foreground text-sm">
                  Ensure rubric criteria have valid structure and scoring
                </p>
              </div>
              <Checkbox
                id="validateRubricCriteria"
                checked={validationRules.validateRubricCriteria}
                onCheckedChange={(checked) =>
                  setValidationRules((prev) => ({
                    ...prev,
                    validateRubricCriteria: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="checkCategoryExists">Check Category Exists</Label>
                <p className="text-muted-foreground text-sm">
                  Verify that specified categories exist in the system
                </p>
              </div>
              <Checkbox
                id="checkCategoryExists"
                checked={validationRules.checkCategoryExists}
                onCheckedChange={(checked) =>
                  setValidationRules((prev) => ({
                    ...prev,
                    checkCategoryExists: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enforceVersionFormat">Enforce Version Format</Label>
                <p className="text-muted-foreground text-sm">
                  Ensure version numbers follow semantic versioning (e.g., 1.2.3)
                </p>
              </div>
              <Checkbox
                id="enforceVersionFormat"
                checked={validationRules.enforceVersionFormat}
                onCheckedChange={(checked) =>
                  setValidationRules((prev) => ({
                    ...prev,
                    enforceVersionFormat: checked as boolean,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="validateCompetencyStructure">Validate Competency Structure</Label>
                <p className="text-muted-foreground text-sm">
                  Check that competencies have required fields and valid data types
                </p>
              </div>
              <Checkbox
                id="validateCompetencyStructure"
                checked={validationRules.validateCompetencyStructure}
                onCheckedChange={(checked) =>
                  setValidationRules((prev) => ({
                    ...prev,
                    validateCompetencyStructure: checked as boolean,
                  }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Format Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Data Format Guide</CardTitle>
          <CardDescription>Reference for proper data formatting in import files</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="csv">
            <TabsList>
              <TabsTrigger value="csv">CSV Format</TabsTrigger>
              <TabsTrigger value="json">JSON Format</TabsTrigger>
              <TabsTrigger value="xlsx">Excel Format</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">Required CSV Columns:</h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <code>template_name</code> - Name of the template
                  </li>
                  <li>
                    <code>category</code> - Medical specialty category
                  </li>
                  <li>
                    <code>version</code> - Version number (e.g., 1.0.0)
                  </li>
                  <li>
                    <code>competency_title</code> - Title of the competency
                  </li>
                  <li>
                    <code>competency_description</code> - Detailed description
                  </li>
                  <li>
                    <code>rubric_criteria</code> - JSON string of rubric criteria
                  </li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">JSON Structure Example:</h4>
                <pre className="overflow-x-auto text-sm">
                  {`{
  "templates": [
    {
      "name": "Internal Medicine Core",
      "category": "Internal Medicine",
      "version": "1.0.0",
      "competencies": [
        {
          "title": "Patient Care",
          "description": "Provide patient care...",
          "rubric_criteria": [
            {
              "level": "Novice",
              "description": "Basic understanding",
              "score": 1
            }
          ]
        }
      ]
    }
  ]
}`}
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="xlsx" className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <h4 className="mb-2 font-medium">Excel Worksheet Structure:</h4>
                <ul className="space-y-1 text-sm">
                  <li>
                    <strong>Sheet 1 (Templates):</strong> Template metadata
                  </li>
                  <li>
                    <strong>Sheet 2 (Competencies):</strong> Competency details
                  </li>
                  <li>
                    <strong>Sheet 3 (Rubrics):</strong> Rubric criteria definitions
                  </li>
                  <li>
                    <strong>Note:</strong> Use template_id to link sheets together
                  </li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Test Validation */}
      <Card>
        <CardHeader>
          <CardTitle>Test Validation</CardTitle>
          <CardDescription>Test your data format before importing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="testData">Sample Data</Label>
              <Textarea
                id="testData"
                placeholder="Paste your CSV data or JSON here to test validation..."
                className="min-h-32"
              />
            </div>
            <div className="flex gap-2">
              <Button>
                <FileCheck className="mr-2 h-4 w-4" />
                Validate Data
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
