/**
 * Time Synchronization API - Long Polling Endpoint
 * 
 * Provides time synchronization via long polling as fallback
 * when Server-Sent Events are not available.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ClockService } from '../../src/lib/clock-service'
import { logger } from '../../src/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || generateClientId()
    const timeout = Number.parseInt(searchParams.get('timeout') || '30000', 10)
    const lastSync = searchParams.get('lastSync')
    
    // Validate timeout (5-60 seconds)
    const pollTimeout = Math.max(5000, Math.min(60000, timeout))
    
    logger.info('Long polling request', {
      clientId,
      timeout: pollTimeout,
      lastSync
    })
    
    // Create promise that resolves with time data
    const timeDataPromise = new Promise((resolve, reject) => {
      const processTimeData = async () => {
        try {
          const clockService = new ClockService()
          const serverTime = await clockService.getServerTime()
          
          resolve({
            serverTime: serverTime.getTime(),
            timestamp: Date.now(),
            accuracy: 50, // Long polling has moderate accuracy
            protocol: 'long-polling',
            requestId: crypto.randomUUID(),
            polling: {
              interval: 1000,
              timeout: 30000,
              nextPoll: Date.now() + 1000
            }
          })
        } catch (error) {
          logger.error('Long polling time sync failed', { error })
          reject(error)
        }
      }
      
      processTimeData()
    })
    
    // Set up timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Long polling timeout'))
      }, pollTimeout)
    })
    
    // Race between data and timeout
    const result = await Promise.race([timeDataPromise, timeoutPromise])
    
    logger.info('Long polling response sent', {
      clientId,
      timestamp: (result as any).timestamp
    })
    
    return NextResponse.json({
      success: true,
      data: result
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Client-ID': clientId,
        'X-Protocol': 'long-polling',
        'X-Poll-Timeout': pollTimeout.toString()
      }
    })
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Long polling timeout') {
      // Timeout is expected behavior
      logger.debug('Long polling timeout', {
        clientId: new URL(request.url).searchParams.get('clientId')
      })
      
      return NextResponse.json({
        success: true,
        data: {
          timeout: true,
          message: 'Long polling timeout - retry recommended',
          timestamp: new Date().toISOString(),
          nextPollDelay: 1000
        }
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Protocol': 'long-polling',
          'X-Status': 'timeout'
        }
      })
    }
    
    logger.error('Long polling error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'LONG_POLLING_ERROR',
        message: 'Long polling request failed',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

/**
 * Handle POST requests for long polling with client state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clientId, lastSync, clientTime } = body
    
    logger.info('Long polling POST request', {
      clientId,
      lastSync,
      clientTime
    })
    
    // Get server time and calculate drift
    const serverTimeData = await ClockService.getServerTime()
    const clientTimestamp = new Date(clientTime).getTime()
    const serverTimestamp = serverTimeData.unixTimestamp
    const drift = serverTimestamp - clientTimestamp
    
    const responseData = {
      ...serverTimeData,
      clientId,
      protocol: 'long-polling',
      drift,
      driftMs: Math.abs(drift),
      clockCorrection: drift > 0 ? 'client_behind' : 'client_ahead',
      sequence: Date.now()
    }
    
    return NextResponse.json({
      success: true,
      data: responseData
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Client-ID': clientId,
        'X-Protocol': 'long-polling',
        'X-Drift': drift.toString()
      }
    })
    
  } catch (error) {
    logger.error('Long polling POST error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'LONG_POLLING_POST_ERROR',
        message: 'Long polling POST request failed',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

/**
 * Generate unique client ID
 */
function generateClientId(): string {
  return `lp_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  })
}