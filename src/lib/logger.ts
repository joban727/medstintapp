/**
 * Production-ready logger utility
 * Replaces console.log statements for better error tracking and debugging
 */

type LogLevel = "error" | "warn" | "info" | "debug"

type LogContext = Record<string, string | number | boolean | null | undefined>

interface SerializedError {
  name: string
  message: string
  stack?: string
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: SerializedError
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development"
  private isProduction = process.env.NODE_ENV === "production"

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isProduction) {
      // In production, only log errors and warnings
      return level === "error" || level === "warn"
    }
    return true // Log everything in development
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return

    if (this.isDevelopment) {
      // In development, use console for immediate feedback
      const method = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log"
      console[method](`[${entry.level.toUpperCase()}] ${entry.message}`, entry.context || "")
      if (entry.error) {
        console.error(entry.error)
      }
    } else {
      // In production, you could send to external logging service
      // For now, we'll suppress most logs except critical errors
      if (entry.level === "error") {
        console.error(`[ERROR] ${entry.message}`, entry.context)
      }
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.output(this.formatMessage("error", message, context, error))
  }

  warn(message: string, context?: LogContext): void {
    this.output(this.formatMessage("warn", message, context))
  }

  info(message: string, context?: LogContext): void {
    this.output(this.formatMessage("info", message, context))
  }

  debug(message: string, context?: LogContext): void {
    this.output(this.formatMessage("debug", message, context))
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for backwards compatibility with existing code
export default logger
