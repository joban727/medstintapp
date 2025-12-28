// import pino from 'pino'
import { db } from '@/database/connection-pool'
import { auditLogs } from '@/database/schema'
import crypto from 'crypto'

// Configure Pino
// const isDev = process.env.NODE_ENV === 'development'

// export const logger = pino({
//   level: process.env.LOG_LEVEL || 'info',
//   transport: isDev
//     ? {
//       target: 'pino-pretty',
//       options: {
//         colorize: true,
//         ignore: 'pid,hostname',
//       },
//     }
//     : undefined,
//   base: {
//     env: process.env.NODE_ENV,
//   },
// })

export const logger = {
  info: (obj: any, msg?: string) => console.log(`[INFO] ${msg}`, obj),
  error: (obj: any, msg?: string) => console.error(`[ERROR] ${msg}`, obj),
  warn: (obj: any, msg?: string) => console.warn(`[WARN] ${msg}`, obj),
  debug: (obj: any, msg?: string) => console.debug(`[DEBUG] ${msg}`, obj),
}

// Audit Log Severity Levels
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'ERROR'

interface AuditLogParams {
  action: string
  userId?: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  severity?: AuditSeverity
  status?: AuditStatus
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit Logger
 * Writes critical business events to the Neon database for compliance and tracking.
 */
export const auditLogger = {
  log: async (params: AuditLogParams) => {
    try {
      // 1. Log to standard logger for immediate visibility
      logger.info({ audit: params }, `[Audit] ${params.action}`)

      // 2. Persist to Neon Database
      await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        action: params.action,
        userId: params.userId,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : undefined,
        severity: params.severity || 'LOW',
        status: params.status || 'SUCCESS',
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      })
    } catch (error) {
      // Fallback: Log the failure to write to DB, but don't crash the app
      logger.error({ err: error, auditParams: params }, 'Failed to write audit log to database')
    }
  }
}
