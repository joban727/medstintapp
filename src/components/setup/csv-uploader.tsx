"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import Papa from "papaparse"
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface CsvUploaderProps {
  onDataLoaded: (data: any[]) => void
  template?: {
    headers: string[]
    data: any[]
  }
  requiredColumns: string[]
}

export function CsvUploader({ onDataLoaded, template, requiredColumns }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        setError("Please upload a CSV file")
        return
      }
      setFile(selectedFile)
      setError(null)
      parseFile(selectedFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  })

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedHeaders = results.meta.fields || []
        const missingColumns = requiredColumns.filter(
          (col) => !parsedHeaders.some((h) => h.toLowerCase() === col.toLowerCase())
        )

        if (missingColumns.length > 0) {
          setError(`Missing required columns: ${missingColumns.join(", ")}`)
          setFile(null)
          setPreviewData([])
          return
        }

        setHeaders(parsedHeaders)
        setPreviewData(results.data.slice(0, 5)) // Preview first 5 rows
        onDataLoaded(results.data)
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`)
      },
    })
  }

  const removeFile = () => {
    setFile(null)
    setPreviewData([])
    setError(null)
    onDataLoaded([])
  }

  const downloadTemplate = () => {
    if (!template) return
    const csv = Papa.unparse(template.data)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4">
      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive
                ? "Drop the CSV here"
                : "Drag & drop a CSV file here, or click to select"}
            </p>
            <p className="text-xs text-muted-foreground">
              Required columns: {requiredColumns.join(", ")}
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={removeFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {previewData.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHead key={header} className="h-8 text-xs">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((header) => (
                          <TableCell key={`${i}-${header}`} className="py-2 text-xs">
                            {row[header]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted/50 p-2 text-center text-xs text-muted-foreground border-t">
                  Showing first {previewData.length} rows
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {template && !file && (
        <div className="flex justify-center">
          <Button variant="link" size="sm" onClick={downloadTemplate}>
            Download CSV Template
          </Button>
        </div>
      )}
    </div>
  )
}
