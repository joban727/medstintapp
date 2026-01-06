/**
 * Safe fetch utility with proper JSON parsing error handling
 * Provides CSRF token handling for state-changing requests
 */

export interface SafeFetchOptions extends RequestInit {
  timeout?: number
  skipCSRF?: boolean // Skip CSRF token for specific requests (e.g., webhooks)
}

export interface SafeFetchResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  details?: unknown[]
  status: number
}

/**
 * Get CSRF token from cookie
 */
function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/(?:^|; )__csrf=([^;]*)/)
  return match ? match[1] : null
}

/**
 * Safe fetch wrapper that handles JSON parsing errors gracefully
 * Automatically includes CSRF tokens for state-changing requests (POST, PUT, PATCH, DELETE)
 */
export async function safeFetch<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse<T>> {
  const { timeout = 10000, skipCSRF = false, ...fetchOptions } = options

  // Automatically add CSRF token for state-changing methods
  const method = (options.method || "GET").toUpperCase()
  const needsCSRF = !skipCSRF && ["POST", "PUT", "PATCH", "DELETE"].includes(method)

  const headers = new Headers(fetchOptions.headers || {})

  if (needsCSRF) {
    const csrfToken = getCSRFToken()
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken)
    }
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Check if response is ok
    if (!response.ok) {
      // Try to parse error response body if available
      let errorDetails: any = {}
      try {
        const text = await response.text()
        if (text && text.trim() !== "") {
          errorDetails = JSON.parse(text)
        }
      } catch (e) {
        // Ignore parsing error for error response
      }

      return {
        success: false,
        error:
          errorDetails.error ||
          errorDetails.message ||
          `HTTP ${response.status}: ${response.statusText}`,
        message: errorDetails.message,
        details: errorDetails.details,
        status: response.status,
      }
    }

    // Get response text first
    const text = await response.text()

    // Check if response has content
    if (!text || text.trim() === "") {
      return {
        success: false,
        error: "Empty response from server",
        status: response.status,
      }
    }

    // Try to parse JSON
    let data: T
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Response text:", text.substring(0, 500)) // Log first 500 chars
      return {
        success: false,
        error: "Invalid JSON response from server",
        status: response.status,
      }
    }

    return {
      success: true,
      data,
      status: response.status,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return {
          success: false,
          error: "Request timeout",
          status: 408,
        }
      }
      return {
        success: false,
        error: error.message,
        status: 0,
      }
    }
    return {
      success: false,
      error: "Unknown error occurred",
      status: 0,
    }
  }
}

/**
 * Safe fetch for API endpoints that return standard response format
 */
export async function safeFetchApi<T = unknown>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse<T>> {
  const result = await safeFetch<{
    success: boolean
    data?: T
    error?: string
    message?: string
    details?: unknown[]
  }>(url, options)

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.message,
      details: result.details,
      status: result.status,
    }
  }

  const apiResponse = result.data
  if (!apiResponse) {
    return {
      success: false,
      error: "No data in response",
      status: result.status,
    }
  }

  // Handle API error responses
  if (apiResponse.success === false) {
    return {
      success: false,
      error: apiResponse.error || apiResponse.message || "API request failed",
      message: apiResponse.message,
      details: apiResponse.details,
      status: result.status,
    }
  }

  return {
    success: true,
    data: apiResponse.data || (apiResponse as unknown as T),
    message: apiResponse.message,
    status: result.status,
  }
}
