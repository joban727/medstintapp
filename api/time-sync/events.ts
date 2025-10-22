/**
 * Time Synchronization API - Server-Sent Events Endpoint
 * 
 * Provides real-time time synchronization via Server-Sent Events
 * with high-precision timestamps and connection management.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { ClockService } from '../../src/lib/clock-service'
import { logger } from '../../src/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId') || generateClientId()
    const interval = Number.parseInt(searchParams.get('interval') || '1000', 10)
    
    // Validate interval (1-60 seconds)
    const syncInterval = Math.max(1000, Math.min(60000, interval))
    
    logger.info('SSE connection established', {
      clientId,
      interval: syncInterval,
      userAgent: request.headers.get('user-agent')
    })
    
    // Create readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        sendEvent(controller, 'connected', {
          clientId,
          serverTime: new Date().toISOString(),
          interval: syncInterval,
          protocol: 'SSE'
        })
        
        // Set up periodic time sync
        const intervalId = setInterval(async () => {
          try {
            const serverTimeData = await ClockService.getServerTime()
            
            sendEvent(controller, 'time-sync', {
              ...serverTimeData,
              clientId,
              sequence: Date.now()
            })
            
          } catch (error) {
            logger.error('SSE time sync error', {
              clientId,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            
            sendEvent(controller, 'error', {
              code: 'SYNC_ERROR',
              message: 'Time synchronization failed',
              timestamp: new Date().toISOString()
            })
          }
        }, syncInterval)
        
        // Handle connection cleanup
        const cleanup = () => {
          clearInterval(intervalId)
          logger.info('SSE connection closed', { clientId })
        }
        
        // Store cleanup function for later use
        ;(controller as any).cleanup = cleanup
        
        // Send heartbeat every 30 seconds
        const heartbeatId = setInterval(() => {
          sendEvent(controller, 'heartbeat', {
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
          })
        }, 30000)
        
        // Store heartbeat cleanup
        ;(controller as any).heartbeatCleanup = () => clearInterval(heartbeatId)
      },
      
      cancel() {
        // Cleanup when connection is closed
        if ((this as any).cleanup) {
          (this as any).cleanup()
        }
        if ((this as any).heartbeatCleanup) {
          (this as any).heartbeatCleanup()
        }
      }
    })
    
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Client-ID': clientId
      }
    })
    
  } catch (error) {
    logger.error('Failed to establish SSE connection', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SSE_CONNECTION_ERROR',
        message: 'Failed to establish Server-Sent Events connection',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

/**
 * Send Server-Sent Event
 */
function sendEvent(controller: ReadableStreamDefaultController, event: string, data: any) {
  const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(eventData))
}

/**
 * Generate unique client ID
 */
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control',
      'Access-Control-Max-Age': '86400'
    }
  })
}