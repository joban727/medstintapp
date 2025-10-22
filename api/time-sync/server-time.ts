/**
 * Time Synchronization API - Server Time Endpoint
 * 
 * Provides high-precision server time for client synchronization
 * with accuracy indicators and timezone information.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ClockService } from '../../src/lib/clock-service'
import { logger } from '../../src/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Get high-precision server time
    const serverTimeData = await ClockService.getServerTime()
    
    // Add performance metrics
    const responseTime = Date.now()
    const processingTime = responseTime - serverTimeData.unixTimestamp
    
    logger.info('Server time requested', {
      timestamp: serverTimeData.timestamp,
      accuracy: serverTimeData.accuracy,
      source: serverTimeData.source,
      processingTime
    })
    
    return NextResponse.json({
      success: true,
      data: {
        ...serverTimeData,
        responseTime,
        processingTime,
        serverInfo: {
          version: '1.0.0',
          protocol: 'HTTP/1.1',
          precision: 'millisecond'
        }
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Timestamp': serverTimeData.unixTimestamp.toString(),
        'X-Accuracy': serverTimeData.accuracy,
        'X-Source': serverTimeData.source
      }
    })
    
  } catch (error) {
    logger.error('Failed to get server time', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SERVER_TIME_ERROR',
        message: 'Failed to retrieve server time',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}