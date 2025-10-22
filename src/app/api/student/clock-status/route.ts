import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2)
  
  try {
    logger.info('Clock-status API request started', { requestId })
    
    // Get the authenticated user directly (streamlined for authenticated sessions)
    const user = await getCurrentUser()
    
    if (!user) {
      logger.warn('Unauthenticated clock-status attempt', { requestId })
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    }

    // Only allow students to check clock status
    if (user.role !== "STUDENT") {
      logger.warn('Non-student clock-status attempt', { 
        requestId, 
        role: user.role 
      })
      return NextResponse.json(
        { error: "Access denied. Students only.", code: "INSUFFICIENT_PERMISSIONS" },
        { status: 403 }
      )
    }

    // Get current clock status
    const status = await ClockService.getClockStatus(user.id)
    
    logger.info('Clock-status API request completed successfully', { 
      requestId, 
      clockedIn: status.clockedIn 
    })

    // Return clock status
    return NextResponse.json({
      success: true,
      ...status
    })

  } catch (error) {
    logger.error('Clock-status API request failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    // Handle ClockError instances with proper error formatting
    if (error instanceof ClockError) {
      const statusCode = error.type === 'VALIDATION_ERROR' ? 400 :
                        error.type === 'BUSINESS_LOGIC_ERROR' ? 400 :
                        error.type === 'AUTHORIZATION_ERROR' ? 403 : 500
      
      return NextResponse.json(
        formatErrorResponse(error),
        { status: statusCode }
      )
    }
    
    // Handle generic errors
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get clock status. Please try again.",
          requestId
        }
      },
      { status: 500 }
    )
  }
}