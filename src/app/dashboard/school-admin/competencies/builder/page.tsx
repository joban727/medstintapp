"use client"

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  Grip,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from "lucide-react"
import { useState, useId } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

interface RubricCriterion {
  id: string
  name: string
  description: string
  weight: number
  levels: {
    id: string
    name: string
    description: string
    points: number
  }[]
}

interface Competency {
  id: string
  name: string
  description: string
  category: string
  isRequired: boolean
  rubric: RubricCriterion[]
  expanded?: boolean
}

interface Template {
  id: string
  name: string
  description: string
  category: string
  version: string
  competencies: Competency[]
  metadata: {
    author: string
    institution: string
    tags: string[]
    isPublic: boolean
  }
}

const initialTemplate: Template = {
  id: "new",
  name: "",
  description: "",
  category: "",
  version: "1.0",
  competencies: [],
  metadata: {
    author: "",
    institution: "",
    tags: [],
    isPublic: false,
  },
}

const categories = [
  "Internal Medicine",
  "Pediatrics",
  "Surgery",
  "Emergency Medicine",
  "Psychiatry",
  "Obstetrics & Gynecology",
  "Family Medicine",
  "Radiology",
  "Pathology",
  "Anesthesiology",
]

const defaultRubricLevels = [
  { id: "1", name: "Novice", description: "Beginning level performance", points: 1 },
  { id: "2", name: "Advanced Beginner", description: "Developing competence", points: 2 },
  { id: "3", name: "Competent", description: "Meets expectations", points: 3 },
  { id: "4", name: "Proficient", description: "Exceeds expectations", points: 4 },
  { id: "5", name: "Expert", description: "Exceptional performance", points: 5 },
]

export default function CustomBuilderPage() {
  const [template, setTemplate] = useState<Template>(initialTemplate)
  const [activeTab, setActiveTab] = useState("template")
  const [selectedCompetency, setSelectedCompetency] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)

  const addCompetency = () => {
    const newCompetency: Competency = {
      id: `comp-${Date.now()}`,
      name: "New Competency",
      description: "",
      category: template.category || categories[0],
      isRequired: false,
      rubric: [],
      expanded: true,
    }
    setTemplate((prev) => ({
      ...prev,
      competencies: [...prev.competencies, newCompetency],
    }))
    setSelectedCompetency(newCompetency.id)
  }

  const updateCompetency = (id: string, updates: Partial<Competency>) => {
    setTemplate((prev) => ({
      ...prev,
      competencies: prev.competencies.map((comp) =>
        comp.id === id ? { ...comp, ...updates } : comp
      ),
    }))
  }

  const deleteCompetency = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      competencies: prev.competencies.filter((comp) => comp.id !== id),
    }))
    if (selectedCompetency === id) {
      setSelectedCompetency(null)
    }
  }

  const addRubricCriterion = (competencyId: string) => {
    const newCriterion: RubricCriterion = {
      id: `crit-${Date.now()}`,
      name: "New Criterion",
      description: "",
      weight: 1,
      levels: [...defaultRubricLevels],
    }
    updateCompetency(competencyId, {
      rubric: [
        ...(template.competencies.find((c) => c.id === competencyId)?.rubric || []),
        newCriterion,
      ],
    })
  }

  const updateRubricCriterion = (
    competencyId: string,
    criterionId: string,
    updates: Partial<RubricCriterion>
  ) => {
    const competency = template.competencies.find((c) => c.id === competencyId)
    if (competency) {
      const updatedRubric = competency.rubric.map((crit) =>
        crit.id === criterionId ? { ...crit, ...updates } : crit
      )
      updateCompetency(competencyId, { rubric: updatedRubric })
    }
  }

  const deleteRubricCriterion = (competencyId: string, criterionId: string) => {
    const competency = template.competencies.find((c) => c.id === competencyId)
    if (competency) {
      const updatedRubric = competency.rubric.filter((crit) => crit.id !== criterionId)
      updateCompetency(competencyId, { rubric: updatedRubric })
    }
  }

  const selectedCompetencyData = template.competencies.find((c) => c.id === selectedCompetency)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Custom Builder</h1>
          <p className="text-muted-foreground">
            Create and customize competency templates with rubrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
            <Eye className="mr-2 h-4 w-4" />
            {previewMode ? "Edit" : "Preview"}
          </Button>
          <Button>
            <Save className="mr-2 h-4 w-4" />
            Save Template
          </Button>
        </div>
      </div>

      {previewMode ? (
        <TemplatePreview template={template} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Panel - Template Info & Competencies */}
          <div className="space-y-6 lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="template">Template Info</TabsTrigger>
                <TabsTrigger value="competencies">
                  Competencies ({template.competencies.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-6">
                <TemplateInfoEditor template={template} setTemplate={setTemplate} />
              </TabsContent>

              <TabsContent value="competencies" className="space-y-6">
                <CompetencyList
                  competencies={template.competencies}
                  selectedCompetency={selectedCompetency}
                  setSelectedCompetency={setSelectedCompetency}
                  updateCompetency={updateCompetency}
                  deleteCompetency={deleteCompetency}
                  addCompetency={addCompetency}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Competency Editor */}
          <div className="space-y-6">
            {selectedCompetencyData ? (
              <CompetencyEditor
                competency={selectedCompetencyData}
                updateCompetency={updateCompetency}
                addRubricCriterion={addRubricCriterion}
                updateRubricCriterion={updateRubricCriterion}
                deleteRubricCriterion={deleteRubricCriterion}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Settings className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-medium text-lg">Select a Competency</h3>
                  <p className="text-muted-foreground">
                    Choose a competency from the list to edit its details and rubric
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateInfoEditor({
  template,
  setTemplate,
}: {
  template: Template
  setTemplate: (template: Template) => void
}) {
  const [newTag, setNewTag] = useState("")
  const nameId = useId()
  const categoryId = useId()
  const descriptionId = useId()
  const authorId = useId()
  const institutionId = useId()
  const publicId = useId()

  const addTag = () => {
    if (newTag.trim() && !template.metadata.tags.includes(newTag.trim())) {
      setTemplate({
        ...template,
        metadata: {
          ...template.metadata,
          tags: [...template.metadata.tags, newTag.trim()],
        },
      })
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setTemplate({
      ...template,
      metadata: {
        ...template.metadata,
        tags: template.metadata.tags.filter((t) => t !== tag),
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Information</CardTitle>
        <CardDescription>Basic information about your competency template</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor={nameId}>Template Name</Label>
            <Input
              id={nameId}
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              placeholder="Enter template name"
            />
          </div>
          <div>
            <Label htmlFor={categoryId}>Category</Label>
            <Select
              value={template.category}
              onValueChange={(value) => setTemplate({ ...template, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor={descriptionId}>Description</Label>
          <Textarea
            id={descriptionId}
            value={template.description}
            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            placeholder="Describe the purpose and scope of this template"
            rows={3}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor={authorId}>Author</Label>
            <Input
              id={authorId}
              value={template.metadata.author}
              onChange={(e) =>
                setTemplate({
                  ...template,
                  metadata: { ...template.metadata, author: e.target.value },
                })
              }
              placeholder="Author name"
            />
          </div>
          <div>
            <Label htmlFor={institutionId}>Institution</Label>
            <Input
              id={institutionId}
              value={template.metadata.institution}
              onChange={(e) =>
                setTemplate({
                  ...template,
                  metadata: { ...template.metadata, institution: e.target.value },
                })
              }
              placeholder="Institution name"
            />
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <div className="mb-2 flex flex-wrap gap-2">
            {template.metadata.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag"
              onKeyPress={(e) => e.key === "Enter" && addTag()}
            />
            <Button onClick={addTag} size="sm">
              Add
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id={publicId}
            checked={template.metadata.isPublic}
            onCheckedChange={(checked) =>
              setTemplate({
                ...template,
                metadata: { ...template.metadata, isPublic: checked },
              })
            }
          />
          <Label htmlFor={publicId}>Make template publicly available</Label>
        </div>
      </CardContent>
    </Card>
  )
}

function CompetencyList({
  competencies,
  selectedCompetency,
  setSelectedCompetency,
  updateCompetency: _updateCompetency,
  deleteCompetency,
  addCompetency,
}: {
  competencies: Competency[]
  selectedCompetency: string | null
  setSelectedCompetency: (id: string | null) => void
  updateCompetency: (id: string, updates: Partial<Competency>) => void
  deleteCompetency: (id: string) => void
  addCompetency: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Competencies</CardTitle>
            <CardDescription>Define the competencies for this template</CardDescription>
          </div>
          <Button onClick={addCompetency}>
            <Plus className="mr-2 h-4 w-4" />
            Add Competency
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {competencies.length === 0 ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 font-medium text-lg">No competencies yet</h3>
            <p className="text-muted-foreground">Add your first competency to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {competencies.map((competency) => (
              <button
                key={competency.id}
                type="button"
                className={`w-full cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                  selectedCompetency === competency.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedCompetency(competency.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Grip className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{competency.name}</h4>
                      <p className="text-muted-foreground text-sm">
                        {competency.rubric.length} criteria
                        {competency.isRequired && " • Required"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {competency.isRequired && (
                      <Badge variant="secondary" className="text-xs">
                        Required
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteCompetency(competency.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CompetencyEditor({
  competency,
  updateCompetency,
  addRubricCriterion,
  updateRubricCriterion,
  deleteRubricCriterion,
}: {
  competency: Competency
  updateCompetency: (id: string, updates: Partial<Competency>) => void
  addRubricCriterion: (competencyId: string) => void
  updateRubricCriterion: (
    competencyId: string,
    criterionId: string,
    updates: Partial<RubricCriterion>
  ) => void
  deleteRubricCriterion: (competencyId: string, criterionId: string) => void
}) {
  const compNameId = useId()
  const compDescId = useId()
  const requiredId = useId()
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Competency Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={compNameId}>Name</Label>
            <Input
              id={compNameId}
              value={competency.name}
              onChange={(e) => updateCompetency(competency.id, { name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor={compDescId}>Description</Label>
            <Textarea
              id={compDescId}
              value={competency.description}
              onChange={(e) => updateCompetency(competency.id, { description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={requiredId}
              checked={competency.isRequired}
              onCheckedChange={(checked) =>
                updateCompetency(competency.id, { isRequired: checked })
              }
            />
            <Label htmlFor={requiredId}>Required competency</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rubric Criteria</CardTitle>
              <CardDescription>Define assessment criteria for this competency</CardDescription>
            </div>
            <Button onClick={() => addRubricCriterion(competency.id)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Criterion
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {competency.rubric.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No rubric criteria defined yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {competency.rubric.map((criterion) => (
                <RubricCriterionEditor
                  key={criterion.id}
                  criterion={criterion}
                  competencyId={competency.id}
                  updateRubricCriterion={updateRubricCriterion}
                  deleteRubricCriterion={deleteRubricCriterion}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function RubricCriterionEditor({
  criterion,
  competencyId,
  updateRubricCriterion,
  deleteRubricCriterion,
}: {
  criterion: RubricCriterion
  competencyId: string
  updateRubricCriterion: (
    competencyId: string,
    criterionId: string,
    updates: Partial<RubricCriterion>
  ) => void
  deleteRubricCriterion: (competencyId: string, criterionId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div>
            <h4 className="font-medium">{criterion.name}</h4>
            <p className="text-muted-foreground text-sm">Weight: {criterion.weight}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteRubricCriterion(competencyId, criterion.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Criterion Name</Label>
              <Input
                value={criterion.name}
                onChange={(e) =>
                  updateRubricCriterion(competencyId, criterion.id, { name: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Weight</Label>
              <Input
                type="number"
                min="1"
                max="10"
                value={criterion.weight}
                onChange={(e) =>
                  updateRubricCriterion(competencyId, criterion.id, {
                    weight: Number.parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={criterion.description}
              onChange={(e) =>
                updateRubricCriterion(competencyId, criterion.id, { description: e.target.value })
              }
              rows={2}
            />
          </div>

          <div>
            <Label>Performance Levels</Label>
            <div className="mt-2 space-y-2">
              {criterion.levels.map((level, index) => (
                <div key={level.id} className="grid gap-2 rounded border p-3 md:grid-cols-4">
                  <Input
                    value={level.name}
                    onChange={(e) => {
                      const updatedLevels = [...criterion.levels]
                      updatedLevels[index] = { ...level, name: e.target.value }
                      updateRubricCriterion(competencyId, criterion.id, { levels: updatedLevels })
                    }}
                    placeholder="Level name"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={level.points}
                    onChange={(e) => {
                      const updatedLevels = [...criterion.levels]
                      updatedLevels[index] = {
                        ...level,
                        points: Number.parseInt(e.target.value) || 0,
                      }
                      updateRubricCriterion(competencyId, criterion.id, { levels: updatedLevels })
                    }}
                    placeholder="Points"
                  />
                  <Input
                    value={level.description}
                    onChange={(e) => {
                      const updatedLevels = [...criterion.levels]
                      updatedLevels[index] = { ...level, description: e.target.value }
                      updateRubricCriterion(competencyId, criterion.id, { levels: updatedLevels })
                    }}
                    placeholder="Description"
                    className="md:col-span-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplatePreview({ template }: { template: Template }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{template.name || "Untitled Template"}</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <span className="text-muted-foreground text-sm">Category:</span>
              <p className="font-medium">{template.category || "Not specified"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Competencies:</span>
              <p className="font-medium">{template.competencies.length}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm">Version:</span>
              <p className="font-medium">{template.version}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {template.competencies.map((competency) => (
          <Card key={competency.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{competency.name}</CardTitle>
                {competency.isRequired && <Badge variant="secondary">Required</Badge>}
              </div>
              {competency.description && (
                <CardDescription>{competency.description}</CardDescription>
              )}
            </CardHeader>
            {competency.rubric.length > 0 && (
              <CardContent>
                <h4 className="mb-3 font-medium">Assessment Criteria</h4>
                <div className="space-y-3">
                  {competency.rubric.map((criterion) => (
                    <div key={criterion.id} className="rounded border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h5 className="font-medium">{criterion.name}</h5>
                        <Badge variant="outline">Weight: {criterion.weight}</Badge>
                      </div>
                      {criterion.description && (
                        <p className="mb-3 text-muted-foreground text-sm">
                          {criterion.description}
                        </p>
                      )}
                      <div className="grid gap-2 md:grid-cols-5">
                        {criterion.levels.map((level) => (
                          <div key={level.id} className="rounded border p-2 text-center">
                            <div className="font-medium text-sm">{level.name}</div>
                            <div className="font-bold text-primary">{level.points}</div>
                            <div className="text-muted-foreground text-xs">{level.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
