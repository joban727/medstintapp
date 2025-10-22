// Production environment configuration
export interface ProductionConfig {
  environment: "development" | "staging" | "production" | "test"
  database: {
    connectionPoolSize: number
    queryTimeout: number
    enableSSL: boolean
    backupEnabled: boolean
    replicationEnabled: boolean
  }
  security: {
    enableCSP: boolean
    enableHSTS: boolean
    enableCORS: boolean
    sessionSecure: boolean
    cookieSecure: boolean
    rateLimitEnabled: boolean
    auditLoggingEnabled: boolean
  }
  performance: {
    enableCaching: boolean
    cacheMaxAge: number
    enableCompression: boolean
    enableCDN: boolean
    maxRequestSize: string
    timeoutMs: number
  }
  monitoring: {
    enableHealthChecks: boolean
    enableMetrics: boolean
    enableErrorTracking: boolean
    logLevel: "error" | "warn" | "info" | "debug"
    enableAPM: boolean
  }
  scaling: {
    maxConcurrentUsers: number
    autoScalingEnabled: boolean
    loadBalancingEnabled: boolean
    sessionStoreType: "memory" | "redis" | "database"
  }
}

// Environment-specific configurations
const PRODUCTION_CONFIG: ProductionConfig = {
  environment: "production",
  database: {
    connectionPoolSize: 20,
    queryTimeout: 30000,
    enableSSL: true,
    backupEnabled: true,
    replicationEnabled: true,
  },
  security: {
    enableCSP: true,
    enableHSTS: true,
    enableCORS: true,
    sessionSecure: true,
    cookieSecure: true,
    rateLimitEnabled: true,
    auditLoggingEnabled: true,
  },
  performance: {
    enableCaching: true,
    cacheMaxAge: 3600,
    enableCompression: true,
    enableCDN: true,
    maxRequestSize: "10mb",
    timeoutMs: 30000,
  },
  monitoring: {
    enableHealthChecks: true,
    enableMetrics: true,
    enableErrorTracking: true,
    logLevel: "warn",
    enableAPM: true,
  },
  scaling: {
    maxConcurrentUsers: 10000,
    autoScalingEnabled: true,
    loadBalancingEnabled: true,
    sessionStoreType: "redis",
  },
}

const STAGING_CONFIG: ProductionConfig = {
  ...PRODUCTION_CONFIG,
  environment: "staging",
  database: {
    ...PRODUCTION_CONFIG.database,
    connectionPoolSize: 10,
    replicationEnabled: false,
  },
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    logLevel: "info",
  },
  scaling: {
    ...PRODUCTION_CONFIG.scaling,
    maxConcurrentUsers: 1000,
    autoScalingEnabled: false,
    sessionStoreType: "database",
  },
}

const DEVELOPMENT_CONFIG: ProductionConfig = {
  ...PRODUCTION_CONFIG,
  environment: "development",
  database: {
    connectionPoolSize: 5,
    queryTimeout: 10000,
    enableSSL: false,
    backupEnabled: false,
    replicationEnabled: false,
  },
  security: {
    enableCSP: false,
    enableHSTS: false,
    enableCORS: true,
    sessionSecure: false,
    cookieSecure: false,
    rateLimitEnabled: false,
    auditLoggingEnabled: true,
  },
  performance: {
    enableCaching: false,
    cacheMaxAge: 0,
    enableCompression: false,
    enableCDN: false,
    maxRequestSize: "50mb",
    timeoutMs: 60000,
  },
  monitoring: {
    enableHealthChecks: true,
    enableMetrics: false,
    enableErrorTracking: true,
    logLevel: "debug",
    enableAPM: false,
  },
  scaling: {
    maxConcurrentUsers: 100,
    autoScalingEnabled: false,
    loadBalancingEnabled: false,
    sessionStoreType: "memory",
  },
}

// Get configuration based on environment
export function getProductionConfig(): ProductionConfig {
  const env = (process.env.NODE_ENV as ProductionConfig["environment"]) || "development"

  switch (env) {
    case "production":
      return PRODUCTION_CONFIG
    case "staging":
      return STAGING_CONFIG
    case "test":
      return DEVELOPMENT_CONFIG
    default:
      return DEVELOPMENT_CONFIG
  }
}

// Health check utilities
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy"
  timestamp: string
  checks: {
    database: { status: string; responseTime?: number; error?: string }
    redis?: { status: string; responseTime?: number; error?: string }
    external?: { status: string; responseTime?: number; error?: string }
  }
  uptime: number
  version: string
}

// Database health check
export async function checkDatabaseHealth(): Promise<{
  status: string
  responseTime?: number
  error?: string
}> {
  try {
    const startTime = Date.now()

    // Simple database ping - replace with actual database check
    // const result = await db.execute(sql`SELECT 1`)

    const responseTime = Date.now() - startTime

    return {
      status: "healthy",
      responseTime,
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown database error",
    }
  }
}

// Redis health check (if using Redis)
export async function checkRedisHealth(): Promise<{
  status: string
  responseTime?: number
  error?: string
}> {
  try {
    const startTime = Date.now()

    // Redis ping - replace with actual Redis check
    // await redis.ping()

    const responseTime = Date.now() - startTime

    return {
      status: "healthy",
      responseTime,
    }
  } catch (error) {
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown Redis error",
    }
  }
}

// Comprehensive health check
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const config = getProductionConfig()
  const startTime = process.uptime()

  const checks = {
    database: await checkDatabaseHealth(),
  } as HealthCheckResult["checks"]

  // Add Redis check if using Redis
  if (config.scaling.sessionStoreType === "redis") {
    checks.redis = await checkRedisHealth()
  }

  // Determine overall status
  const allChecks = Object.values(checks)
  const hasUnhealthy = allChecks.some((check) => check.status === "unhealthy")
  const hasDegraded = allChecks.some((check) => check.status === "degraded")

  const status = hasUnhealthy ? "unhealthy" : hasDegraded ? "degraded" : "healthy"

  return {
    status,
    timestamp: new Date().toISOString(),
    checks,
    uptime: startTime,
    version: process.env.APP_VERSION || "1.0.0",
  }
}

// Performance monitoring
export interface PerformanceMetrics {
  requestCount: number
  averageResponseTime: number
  errorRate: number
  activeConnections: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  cpuUsage: number
}

// Simple in-memory metrics (replace with proper monitoring solution in production)
const metrics = {
  requests: 0,
  totalResponseTime: 0,
  errors: 0,
  activeConnections: 0,
}

export function trackRequest(responseTime: number, isError = false) {
  metrics.requests++
  metrics.totalResponseTime += responseTime
  if (isError) metrics.errors++
}

export function trackConnection(delta: number) {
  metrics.activeConnections += delta
}

export function getPerformanceMetrics(): PerformanceMetrics {
  const memUsage = process.memoryUsage()

  return {
    requestCount: metrics.requests,
    averageResponseTime: metrics.requests > 0 ? metrics.totalResponseTime / metrics.requests : 0,
    errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0,
    activeConnections: metrics.activeConnections,
    memoryUsage: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
  }
}

// Security headers for production
export function getSecurityHeaders(config: ProductionConfig): Record<string, string> {
  const headers: Record<string, string> = {}

  if (config.security.enableCSP) {
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  }

  if (config.security.enableHSTS) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
  }

  headers["X-Frame-Options"] = "DENY"
  headers["X-Content-Type-Options"] = "nosniff"
  headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
  headers["Permissions-Policy"] = "camera=(), microphone=()"

  return headers
}

// Environment validation
export function validateEnvironment(): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required environment variables for Clerk-based app
  const requiredEnvVars = ["DATABASE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    }
  }

  // Validate Clerk keys format
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const secretKey = process.env.CLERK_SECRET_KEY

  if (publishableKey && !publishableKey.startsWith("pk_")) {
    errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must start with "pk_"')
  }

  if (secretKey && !secretKey.startsWith("sk_")) {
    errors.push('CLERK_SECRET_KEY must start with "sk_"')
  }

  // Check for placeholder values
  if (
    publishableKey &&
    (publishableKey.includes("placeholder") || publishableKey === "pk_test_placeholder")
  ) {
    errors.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY contains placeholder value")
  }

  if (secretKey && (secretKey.includes("placeholder") || secretKey.length < 50)) {
    errors.push("CLERK_SECRET_KEY appears to be incomplete or contains placeholder value")
  }

  // Check production-specific requirements
  if (process.env.NODE_ENV === "production") {
    if (publishableKey && !publishableKey.startsWith("pk_live_")) {
      warnings.push("Using test Clerk keys in production - should use live keys (pk_live_)")
    }

    if (secretKey && !secretKey.startsWith("sk_live_")) {
      warnings.push("Using test Clerk keys in production - should use live keys (sk_live_)")
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      warnings.push("NEXT_PUBLIC_APP_URL not set - may affect redirects")
    }

    if (!process.env.REDIS_URL && getProductionConfig().scaling.sessionStoreType === "redis") {
      errors.push("Redis URL is required for production session storage")
    }

    if (!process.env.MONITORING_API_KEY) {
      warnings.push("Monitoring API key not set - metrics collection may be limited")
    }

    if (!process.env.ERROR_TRACKING_DSN) {
      warnings.push("Error tracking DSN not set - error reporting may be limited")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// Graceful shutdown handler
export function setupGracefulShutdown() {
  const gracefulShutdown = (_signal: string) => {
    // Graceful shutdown initiated

    // Close database connections
    // Close Redis connections
    // Stop accepting new requests
    // Wait for existing requests to complete

    setTimeout(() => {
      // Graceful shutdown completed
      process.exit(0)
    }, 10000) // 10 second timeout
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))
}

// Request timeout middleware
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    }),
  ])
}

// Production readiness checklist
export function getProductionReadinessChecklist(): {
  category: string
  items: { name: string; status: "pass" | "fail" | "warning"; details?: string }[]
}[] {
  const config = getProductionConfig()
  const envValidation = validateEnvironment()

  return [
    {
      category: "Environment Configuration",
      items: [
        {
          name: "Environment Variables",
          status: envValidation.valid ? "pass" : "fail",
          details: envValidation.errors.join(", ") || undefined,
        },
        {
          name: "Node Environment",
          status: process.env.NODE_ENV === "production" ? "pass" : "warning",
          details: `Current: ${process.env.NODE_ENV}`,
        },
      ],
    },
    {
      category: "Security",
      items: [
        {
          name: "HTTPS Enabled",
          status: config.security.sessionSecure ? "pass" : "fail",
        },
        {
          name: "Security Headers",
          status: config.security.enableCSP && config.security.enableHSTS ? "pass" : "warning",
        },
        {
          name: "Rate Limiting",
          status: config.security.rateLimitEnabled ? "pass" : "warning",
        },
      ],
    },
    {
      category: "Database",
      items: [
        {
          name: "SSL Enabled",
          status: config.database.enableSSL ? "pass" : "warning",
        },
        {
          name: "Backup Enabled",
          status: config.database.backupEnabled ? "pass" : "warning",
        },
        {
          name: "Connection Pooling",
          status: config.database.connectionPoolSize > 5 ? "pass" : "warning",
        },
      ],
    },
    {
      category: "Monitoring",
      items: [
        {
          name: "Health Checks",
          status: config.monitoring.enableHealthChecks ? "pass" : "warning",
        },
        {
          name: "Error Tracking",
          status: config.monitoring.enableErrorTracking ? "pass" : "warning",
        },
        {
          name: "Performance Monitoring",
          status: config.monitoring.enableAPM ? "pass" : "warning",
        },
      ],
    },
  ]
}

export { PRODUCTION_CONFIG, STAGING_CONFIG, DEVELOPMENT_CONFIG }
