/**
 * High-precision timing utilities for accurate time tracking
 * Uses performance.now() for millisecond-accurate timing
 */

export interface HighPrecisionTimestamp {
  /** Standard Date object for database storage */
  date: Date
  /** High-precision timestamp in milliseconds since page load */
  performanceTimestamp: number
  /** High-precision timestamp in milliseconds since Unix epoch */
  highPrecisionTimestamp: number
  /** ISO string representation with microsecond precision */
  isoString: string
}

export interface TimeDuration {
  /** Duration in milliseconds with high precision */
  milliseconds: number
  /** Duration in seconds with decimal precision */
  seconds: number
  /** Duration in minutes with decimal precision */
  minutes: number
  /** Duration in hours with decimal precision */
  hours: number
  /** Human-readable duration string */
  formatted: string
}

/**
 * Creates a high-precision timestamp
 */
export function createHighPrecisionTimestamp(): HighPrecisionTimestamp {
  const now = Date.now()
  const performanceNow = performance.now()

  // Calculate high-precision timestamp by combining Date.now() with performance.now()
  // This gives us millisecond accuracy relative to the Unix epoch
  const highPrecisionTimestamp = now + (performanceNow % 1)

  const date = new Date(highPrecisionTimestamp)

  return {
    date,
    performanceTimestamp: performanceNow,
    highPrecisionTimestamp,
    isoString: date.toISOString(),
  }
}

/**
 * Calculates high-precision duration between two timestamps
 */
export function calculateHighPrecisionDuration(
  startTimestamp: HighPrecisionTimestamp,
  endTimestamp?: HighPrecisionTimestamp
): TimeDuration {
  const end = endTimestamp || createHighPrecisionTimestamp()
  const durationMs = end.highPrecisionTimestamp - startTimestamp.highPrecisionTimestamp

  const seconds = durationMs / 1000
  const minutes = seconds / 60
  const hours = minutes / 60

  return {
    milliseconds: durationMs,
    seconds,
    minutes,
    hours,
    formatted: formatDuration(durationMs),
  }
}

/**
 * Formats duration in a human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const ms = Math.floor(milliseconds % 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  if (seconds > 0) {
    return `${seconds}.${ms.toString().padStart(3, "0")}s`
  }
  return `${ms}ms`
}

/**
 * Converts high-precision timestamp to database-compatible format
 */
export function toDbTimestamp(timestamp: HighPrecisionTimestamp): Date {
  return timestamp.date
}

/**
 * Creates a high-precision timestamp from a database Date
 */
export function fromDbTimestamp(date: Date): HighPrecisionTimestamp {
  const timestamp = date.getTime()

  return {
    date,
    performanceTimestamp: performance.now(), // Current performance time
    highPrecisionTimestamp: timestamp,
    isoString: date.toISOString(),
  }
}

/**
 * Real-time duration calculator for active time tracking
 */
export class RealTimeDurationCalculator {
  private startTimestamp: HighPrecisionTimestamp
  private intervalId?: NodeJS.Timeout
  private callbacks: ((duration: TimeDuration) => void)[] = []

  constructor(startTimestamp: HighPrecisionTimestamp) {
    this.startTimestamp = startTimestamp
  }

  /**
   * Starts real-time duration calculation with callbacks
   */
  start(callback: (duration: TimeDuration) => void, intervalMs = 100): void {
    this.callbacks.push(callback)

    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        const duration = calculateHighPrecisionDuration(this.startTimestamp)
        this.callbacks.forEach((cb) => cb(duration))
      }, intervalMs)

      // Only use unref in Node.js environment to prevent process hanging
      if (typeof process !== "undefined" && process.versions?.node) {
        ;(this.intervalId as any).unref?.()
      }
    }
  }

  /**
   * Stops real-time calculation
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
    this.callbacks = []
  }

  /**
   * Gets current duration without starting interval
   */
  getCurrentDuration(): TimeDuration {
    return calculateHighPrecisionDuration(this.startTimestamp)
  }

  /**
   * Updates the start timestamp (useful for clock-in updates)
   */
  updateStartTimestamp(newStartTimestamp: HighPrecisionTimestamp): void {
    this.startTimestamp = newStartTimestamp
  }
}

/**
 * Performance monitoring for timing operations
 */
export class TimingPerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map()

  /**
   * Measures the performance of a timing operation
   */
  static measure<T>(operationName: string, operation: () => T): T {
    const start = performance.now()
    const result = operation()
    const end = performance.now()
    const duration = end - start

    if (!TimingPerformanceMonitor.measurements.has(operationName)) {
      TimingPerformanceMonitor.measurements.set(operationName, [])
    }

    TimingPerformanceMonitor.measurements.get(operationName)!.push(duration)

    // Keep only last 100 measurements to prevent memory leaks
    const measurements = TimingPerformanceMonitor.measurements.get(operationName)!
    if (measurements.length > 100) {
      measurements.shift()
    }

    return result
  }

  /**
   * Gets performance statistics for an operation
   */
  static getStats(operationName: string) {
    const measurements = TimingPerformanceMonitor.measurements.get(operationName) || []
    if (measurements.length === 0) return null

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)

    return {
      count: measurements.length,
      average: avg,
      min,
      max,
      latest: measurements[measurements.length - 1],
    }
  }

  /**
   * Clears all measurements
   */
  static clear(): void {
    TimingPerformanceMonitor.measurements.clear()
  }
}
