import { type NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-clerk"
import { ClockService } from "@/lib/clock-service"
import { ClockError, formatErrorResponse } from "@/lib/enhanced-error-handling"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2)
  
  try {
    logger.info('Clock-out API request started', { requestId })
    
    // Get the authenticated user directly (streamlined for authenticated sessions)
    const user = await getCurrentUser()
    
    if (!user) {
      logger.warn('Unauthenticated clock-out attempt', { requestId })
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 }
      )
    }

    // Only allow students to clock out
    if (user.role !== "STUDENT") {
      logger.warn('Non-student clock-out attempt', { 
        requestId, 
        role: user.role 
      })
      return NextResponse.json(
        { error: "Access denied. Students only.", code: "INSUFFICIENT_PERMISSIONS" },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    
    const clockOutRequest = {
      studentId: user.id,
      timestamp: body.timestamp,
      location: body.location,
      notes: body.notes,
      activities: body.activities
    }

    // Execute atomic clock-out operation
    const result = await ClockService.clockOut(clockOutRequest)
    
    logger.info('Clock-out API request completed successfully', { 
      requestId, 
      recordId: result.recordId,
      totalHours: result.totalHours
    })

    // Return success response with enhanced clock status
    return NextResponse.json({
      success: true,
      status: "clocked_out",
      clockedIn: result.clockedIn,
      clockInTime: result.clockInTime,
      clockOutTime: result.clockOutTime,
      totalHours: result.totalHours,
      recordId: result.recordId,
      timeRecordId: result.recordId,
      isClocked: result.isClocked,
      currentDuration: result.currentDuration || 0
    })

  } catch (error) {
    logger.error('Clock-out API request failed', {
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
          message: "Failed to clock out. Please try again.",
          requestId
        }
      },
      { status: 500 }
    )
  }
}