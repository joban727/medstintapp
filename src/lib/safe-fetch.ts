/**
 * Safe fetch utility with proper JSON parsing error handling
 * Prevents "Unexpected end of JSON input" errors
 */

export interface SafeFetchOptions extends RequestInit {
  timeout?: number
}

export interface SafeFetchResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  status: number
}

/**
 * Safe fetch wrapper that handles JSON parsing errors gracefully
 */
export async function safeFetch<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse<T>> {
  const { timeout = 10000, ...fetchOptions } = options

  try {
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // Check if response is ok
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      }
    }

    // Get response text first
    const text = await response.text()

    // Check if response has content
    if (!text || text.trim() === '') {
      return {
        success: false,
        error: 'Empty response from server',
        status: response.status,
      }
    }

    // Try to parse JSON
    let data: T
    try {
      data = JSON.parse(text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Response text:', text.substring(0, 500)) // Log first 500 chars
      return {
        success: false,
        error: 'Invalid JSON response from server',
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
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout',
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
      error: 'Unknown error occurred',
      status: 0,
    }
  }
}

/**
 * Safe fetch for API endpoints that return standard response format
 */
export async function safeFetchApi<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse<T>> {
  const result = await safeFetch<{ success: boolean; data?: T; error?: string; message?: string }>(
    url,
    options
  )

  if (!result.success) {
    return result
  }

  const apiResponse = result.data
  if (!apiResponse) {
    return {
      success: false,
      error: 'No data in response',
      status: result.status,
    }
  }

  // Handle API error responses
  if (apiResponse.success === false) {
    return {
      success: false,
      error: apiResponse.error || apiResponse.message || 'API request failed',
      status: result.status,
    }
  }

  return {
    success: true,
    data: apiResponse.data || apiResponse,
    status: result.status,
  }
}