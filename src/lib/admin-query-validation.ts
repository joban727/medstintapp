// Validation utility for admin query analysis
// Only allows single, simple SELECT statements without dangerous functions

export interface ValidationResult {
  valid: boolean
  reason?: string
  sanitized?: string
}

// Forbidden patterns for analysis safety
export const forbiddenAnalysisPattern =
  /(insert\s+into|update\s+|delete\s+from|drop\s+|alter\s+|create\s+|truncate\s+|call\s+|do\s+|pg_sleep\s*\(|pg_read_file|pg_write_file|lo_import|lo_export|dblink\s*\()/i

export function validateAdminSelectQuery(query: string): ValidationResult {
  const trimmed = String(query || "").trim()
  if (!trimmed) {
    return { valid: false, reason: "Query is required" }
  }

  if (trimmed.length > 2000) {
    return { valid: false, reason: "Query length exceeds 2000 characters" }
  }

  if (trimmed.includes(";")) {
    return { valid: false, reason: "Multiple statements are not allowed" }
  }

  // Check for SELECT first, before checking forbidden patterns
  // This ensures we give the correct error message for non-SELECT queries
  if (!/^select\s+/i.test(trimmed)) {
    return { valid: false, reason: "Only single SELECT queries are allowed" }
  }

  // Now check for forbidden patterns within SELECT queries
  if (forbiddenAnalysisPattern.test(trimmed)) {
    return { valid: false, reason: "Forbidden keywords/functions present" }
  }

  return { valid: true, sanitized: trimmed }
}
