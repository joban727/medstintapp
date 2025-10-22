/**
 * Time Synchronization API - Sync Status Endpoint
 * 
 * Provides real-time synchronization status and health metrics
 * for monitoring and diagnostics.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { TimeSyncService } from '../../src/lib/time-sync-service'
import { logger } from '../../src/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const syncService = TimeSyncService.getInstance()
    
    // Get comprehensive sync status
    const status = {
      isConnected: syncService.isConnected(),
      currentTime: syncService.getCurrentTime().toISOString(),
      accuracy: syncService.getAccuracy(),
      drift: syncService.getDrift(),
      protocol: syncService.getCurrentProtocol(),
      connectionHealth: syncService.getConnectionHealth(),
      lastSyncTime: syncService.getLastSyncTime()?.toISOString() || null,
      syncCount: syncService.getSyncCount(),
      errorCount: syncService.getErrorCount(),
      uptime: syncService.getUptime(),
      serverTime: new Date().toISOString(),
      systemInfo: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: Intl.DateTimeFormat().resolvedOptions().locale,
        platform: process.platform,
        nodeVersion: process.version
      }
    }
    
    // Calculate sync quality score
    const qualityScore = calculateSyncQuality(status)
    
    logger.info('Sync status requested', {
      isConnected: status.isConnected,
      accuracy: status.accuracy,
      drift: status.drift,
      qualityScore
    })
    
    return NextResponse.json({
      success: true,
      data: {
        ...status,
        qualityScore,
        recommendations: generateRecommendations(status)
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Sync-Status': status.isConnected ? 'connected' : 'disconnected',
        'X-Sync-Accuracy': status.accuracy,
        'X-Quality-Score': qualityScore.toString()
      }
    })
    
  } catch (error) {
    logger.error('Failed to get sync status', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'SYNC_STATUS_ERROR',
        message: 'Failed to retrieve synchronization status',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

/**
 * Calculate sync quality score (0-100)
 */
function calculateSyncQuality(status: any): number {
  let score = 0
  
  // Connection status (40 points)
  if (status.isConnected) {
    score += 40
  }
  
  // Accuracy (30 points)
  switch (status.accuracy) {
    case 'high':
      score += 30
      break
    case 'medium':
      score += 20
      break
    case 'low':
      score += 10
      break
  }
  
  // Drift (20 points)
  if (status.drift < 100) {
    score += 20
  } else if (status.drift < 500) {
    score += 15
  } else if (status.drift < 1000) {
    score += 10
  } else if (status.drift < 5000) {
    score += 5
  }
  
  // Connection health (10 points)
  if (status.connectionHealth > 90) {
    score += 10
  } else if (status.connectionHealth > 70) {
    score += 7
  } else if (status.connectionHealth > 50) {
    score += 5
  } else if (status.connectionHealth > 30) {
    score += 3
  }
  
  return Math.min(100, Math.max(0, score))
}

/**
 * Generate recommendations based on sync status
 */
function generateRecommendations(status: any): string[] {
  const recommendations: string[] = []
  
  if (!status.isConnected) {
    recommendations.push('Check network connectivity and firewall settings')
    recommendations.push('Verify time synchronization service is running')
  }
  
  if (status.accuracy === 'low') {
    recommendations.push('Consider switching to a more reliable time source')
    recommendations.push('Check for network latency issues')
  }
  
  if (status.drift > 1000) {
    recommendations.push('High time drift detected - consider manual time correction')
    recommendations.push('Check system clock configuration')
  }
  
  if (status.connectionHealth < 70) {
    recommendations.push('Poor connection health - check network stability')
    recommendations.push('Consider using alternative synchronization protocol')
  }
  
  if (status.errorCount > 10) {
    recommendations.push('High error count detected - check service logs')
    recommendations.push('Consider restarting time synchronization service')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Time synchronization is operating optimally')
  }
  
  return recommendations
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