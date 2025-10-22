import { useId } from "react"

/**
 * Custom hook to generate unique IDs for form elements and other components
 * This helps avoid duplicate IDs when components are reused
 */
export function useUniqueId(prefix?: string): string {
  const id = useId()
  return prefix ? `${prefix}-${id}` : id
}

/**
 * Generate multiple unique IDs at once
 * @param count Number of IDs to generate
 * @param prefix Optional prefix for all IDs
 * @returns Array of unique ID strings
 */
export function useUniqueIds(count: number, prefix?: string): string[] {
  const baseId = useId()
  return Array.from({ length: count }, (_, index) =>
    prefix ? `${prefix}-${baseId}-${index}` : `${baseId}-${index}`
  )
}

/**
 * Generate a unique ID for a specific field name
 * @param fieldName The field name to create an ID for
 * @returns Unique ID string
 */
export function useFieldId(fieldName: string): string {
  const id = useId()
  return `${fieldName}-${id}`
}

/**
 * Generate multiple field IDs at once
 * @param fieldNames Array of field names
 * @returns Object mapping field names to unique IDs
 */
export function useFieldIds<T extends string>(fieldNames: T[]): Record<T, string> {
  const baseId = useId()
  return fieldNames.reduce(
    (acc, fieldName, index) => {
      acc[fieldName] = `${fieldName}-${baseId}-${index}`
      return acc
    },
    {} as Record<T, string>
  )
}
