/**
 * Time Synchronization Test Suite
 * Tests accuracy, performance, and reliability of the time sync system
 */

interface TestResult {
  testName: string
  passed: boolean
  actualValue: number
  expectedValue: number
  tolerance: number
  details: string
  timestamp: number
}

interface PerformanceMetrics {
  connectionTime: number
  firstSyncTime: number
  averageLatency: number
  syncFrequency: number
  driftStability: number
  accuracyConsistency: number
}

interface AccuracyTest {
  driftMeasurements: number[]
  averageDrift: number
  maxDrift: number
  minDrift: number
  standardDeviation: number
  withinTolerance: boolean
}

export class TimeSyncTester {
  private results: TestResult[] = []
  private startTime = 0
  private syncEvents: Array<{ timestamp: number; drift: number; latency?: number }> = []
  
  constructor(private toleranceMs = 100) {}

  /**
   * Run comprehensive time sync accuracy tests
   */
  async runAccuracyTests(): Promise<AccuracyTest> {
    console.log('🧪 Starting Time Sync Accuracy Tests...')
    
    const testDuration = 60000 // 1 minute test
    const sampleInterval = 1000 // Sample every second
    const samples: number[] = []
    
    this.startTime = Date.now()
    
    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        try {
          // Test server time accuracy
          const clientTime = Date.now()
          const response = await fetch('/api/time-sync/status')
          const data = await response.json()
          
          if (data.serverTime) {
            const serverTime = new Date(data.serverTime).getTime()
            const drift = serverTime - clientTime
            samples.push(Math.abs(drift))
            
            this.syncEvents.push({
              timestamp: clientTime,
              drift: drift,
            })
          }
          
          // Stop after test duration
          if (Date.now() - this.startTime >= testDuration) {
            clearInterval(interval)
            
            const averageDrift = samples.reduce((sum, d) => sum + d, 0) / samples.length
            const maxDrift = Math.max(...samples)
            const minDrift = Math.min(...samples)
            
            // Calculate standard deviation
            const variance = samples.reduce((sum, d) => sum + (d - averageDrift) ** 2, 0) / samples.length
            const standardDeviation = Math.sqrt(variance)
            
            const withinTolerance = maxDrift <= this.toleranceMs
            
            const result: AccuracyTest = {
              driftMeasurements: samples,
              averageDrift,
              maxDrift,
              minDrift,
              standardDeviation,
              withinTolerance,
            }
            
            this.addResult({
              testName: 'Time Sync Accuracy',
              passed: withinTolerance,
              actualValue: maxDrift,
              expectedValue: this.toleranceMs,
              tolerance: 0,
              details: `Max drift: ${maxDrift.toFixed(2)}ms, Avg: ${averageDrift.toFixed(2)}ms, StdDev: ${standardDeviation.toFixed(2)}ms`,
              timestamp: Date.now(),
            })
            
            resolve(result)
          }
        } catch (error) {
          console.error('Accuracy test error:', error)
        }
      }, sampleInterval)
    })
  }

  /**
   * Test connection establishment performance
   */
  async testConnectionPerformance(): Promise<PerformanceMetrics> {
    console.log('⚡ Testing Connection Performance...')
    
    const startTime = Date.now()
    let connectionTime = 0
    let firstSyncTime = 0
    
    // Test SSE connection time
    try {
      const clientId = `test_${Date.now()}`
      const eventSource = new EventSource(`/api/time-sync/connect?clientId=${clientId}`)
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          eventSource.close()
          reject(new Error('Connection timeout'))
        }, 10000)
        
        eventSource.onopen = () => {
          connectionTime = Date.now() - startTime
          clearTimeout(timeout)
        }
        
        eventSource.onmessage = (event) => {
          if (firstSyncTime === 0) {
            firstSyncTime = Date.now() - startTime
            eventSource.close()
            resolve()
          }
        }
        
        eventSource.onerror = () => {
          clearTimeout(timeout)
          eventSource.close()
          reject(new Error('Connection failed'))
        }
      })
    } catch (error) {
      console.error('Connection performance test failed:', error)
    }
    
    // Calculate latency metrics
    const latencies = this.syncEvents
      .filter(e => e.latency !== undefined)
      .map(e => e.latency as number)
    
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
      : 0
    
    // Calculate sync frequency
    const syncFrequency = this.syncEvents.length > 0 
      ? this.syncEvents.length / ((Date.now() - this.startTime) / 1000)
      : 0
    
    // Calculate drift stability (lower is better)
    const drifts = this.syncEvents.map(e => e.drift)
    const driftVariance = drifts.length > 1 
      ? drifts.reduce((sum, d, i, arr) => {
          const avg = arr.reduce((s, v) => s + v, 0) / arr.length
          return sum + (d - avg) ** 2
        }, 0) / drifts.length
      : 0
    
    const driftStability = Math.sqrt(driftVariance)
    
    const metrics: PerformanceMetrics = {
      connectionTime,
      firstSyncTime,
      averageLatency,
      syncFrequency,
      driftStability,
      accuracyConsistency: driftStability < 50 ? 1 : 0, // Binary metric
    }
    
    // Add performance test results
    this.addResult({
      testName: 'Connection Time',
      passed: connectionTime < 2000,
      actualValue: connectionTime,
      expectedValue: 2000,
      tolerance: 500,
      details: `Connection established in ${connectionTime}ms`,
      timestamp: Date.now(),
    })
    
    this.addResult({
      testName: 'First Sync Time',
      passed: firstSyncTime < 3000,
      actualValue: firstSyncTime,
      expectedValue: 3000,
      tolerance: 1000,
      details: `First sync received in ${firstSyncTime}ms`,
      timestamp: Date.now(),
    })
    
    this.addResult({
      testName: 'Drift Stability',
      passed: driftStability < 50,
      actualValue: driftStability,
      expectedValue: 50,
      tolerance: 25,
      details: `Drift standard deviation: ${driftStability.toFixed(2)}ms`,
      timestamp: Date.now(),
    })
    
    return metrics
  }

  /**
   * Test fallback mechanism (SSE to Long Polling)
   */
  async testFallbackMechanism(): Promise<boolean> {
    console.log('🔄 Testing Fallback Mechanism...')
    
    try {
      // Test long polling directly
      const clientId = `fallback_test_${Date.now()}`
      const response = await fetch(`/api/time-sync/poll?clientId=${clientId}&lastEventTime=0`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      const hasSyncData = data.timestamp && data.serverTime
      
      this.addResult({
        testName: 'Long Polling Fallback',
        passed: hasSyncData,
        actualValue: hasSyncData ? 1 : 0,
        expectedValue: 1,
        tolerance: 0,
        details: hasSyncData ? 'Long polling working correctly' : 'Long polling failed',
        timestamp: Date.now(),
      })
      
      return hasSyncData
    } catch (error) {
      console.error('Fallback test error:', error)
      
      this.addResult({
        testName: 'Long Polling Fallback',
        passed: false,
        actualValue: 0,
        expectedValue: 1,
        tolerance: 0,
        details: `Fallback failed: ${error}`,
        timestamp: Date.now(),
      })
      
      return false
    }
  }

  /**
   * Test synchronized clock operations
   */
  async testSynchronizedClockOperations(): Promise<boolean> {
    console.log('🕐 Testing Synchronized Clock Operations...')
    
    try {
      // Test sync-in endpoint
      const clientId = `clock_test_${Date.now()}`
      const clientTimestamp = Date.now()
      
      const clockInResponse = await fetch('/api/clock/sync-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientTimestamp,
          siteId: 'test-site',
          rotationId: 'test-rotation',
          notes: 'Test clock-in',
        }),
      })
      
      const clockInSuccess = clockInResponse.ok
      
      this.addResult({
        testName: 'Synchronized Clock-In',
        passed: clockInSuccess,
        actualValue: clockInSuccess ? 1 : 0,
        expectedValue: 1,
        tolerance: 0,
        details: clockInSuccess ? 'Clock-in successful' : `Clock-in failed: ${clockInResponse.status}`,
        timestamp: Date.now(),
      })
      
      // Test sync-out endpoint if clock-in succeeded
      if (clockInSuccess) {
        const clockOutResponse = await fetch('/api/clock/sync-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clientTimestamp: Date.now(),
            notes: 'Test clock-out',
          }),
        })
        
        const clockOutSuccess = clockOutResponse.ok
        
        this.addResult({
          testName: 'Synchronized Clock-Out',
          passed: clockOutSuccess,
          actualValue: clockOutSuccess ? 1 : 0,
          expectedValue: 1,
          tolerance: 0,
          details: clockOutSuccess ? 'Clock-out successful' : `Clock-out failed: ${clockOutResponse.status}`,
          timestamp: Date.now(),
        })
        
        return clockOutSuccess
      }
      
      return false
    } catch (error) {
      console.error('Clock operations test error:', error)
      
      this.addResult({
        testName: 'Synchronized Clock Operations',
        passed: false,
        actualValue: 0,
        expectedValue: 1,
        tolerance: 0,
        details: `Clock operations failed: ${error}`,
        timestamp: Date.now(),
      })
      
      return false
    }
  }

  /**
   * Run all tests and generate comprehensive report
   */
  async runAllTests(): Promise<{
    passed: boolean
    accuracy: AccuracyTest
    performance: PerformanceMetrics
    fallbackWorking: boolean
    clockOperationsWorking: boolean
    results: TestResult[]
    summary: string
  }> {
    console.log('🚀 Starting Comprehensive Time Sync Test Suite...')
    
    const accuracy = await this.runAccuracyTests()
    const performance = await this.testConnectionPerformance()
    const fallbackWorking = await this.testFallbackMechanism()
    const clockOperationsWorking = await this.testSynchronizedClockOperations()
    
    const allTestsPassed = this.results.every(r => r.passed)
    
    const summary = this.generateSummary(accuracy, performance, fallbackWorking, clockOperationsWorking)
    
    return {
      passed: allTestsPassed,
      accuracy,
      performance,
      fallbackWorking,
      clockOperationsWorking,
      results: this.results,
      summary,
    }
  }

  /**
   * Generate test summary report
   */
  private generateSummary(
    accuracy: AccuracyTest,
    performance: PerformanceMetrics,
    fallbackWorking: boolean,
    clockOperationsWorking: boolean
  ): string {
    const passedTests = this.results.filter(r => r.passed).length
    const totalTests = this.results.length
    
    return `
📊 TIME SYNCHRONIZATION TEST REPORT
=====================================

Overall Status: ${passedTests === totalTests ? '✅ PASSED' : '❌ FAILED'}
Tests Passed: ${passedTests}/${totalTests}

🎯 ACCURACY METRICS
- Average Drift: ${accuracy.averageDrift.toFixed(2)}ms
- Maximum Drift: ${accuracy.maxDrift.toFixed(2)}ms
- Standard Deviation: ${accuracy.standardDeviation.toFixed(2)}ms
- Within ±${this.toleranceMs}ms Tolerance: ${accuracy.withinTolerance ? '✅' : '❌'}

⚡ PERFORMANCE METRICS
- Connection Time: ${performance.connectionTime}ms
- First Sync Time: ${performance.firstSyncTime}ms
- Average Latency: ${performance.averageLatency.toFixed(2)}ms
- Sync Frequency: ${performance.syncFrequency.toFixed(2)} Hz
- Drift Stability: ${performance.driftStability.toFixed(2)}ms

🔧 FUNCTIONALITY TESTS
- Fallback Mechanism: ${fallbackWorking ? '✅' : '❌'}
- Clock Operations: ${clockOperationsWorking ? '✅' : '❌'}

📋 DETAILED RESULTS
${this.results.map(r => 
  `${r.passed ? '✅' : '❌'} ${r.testName}: ${r.details}`
).join('\n')}

${passedTests === totalTests 
  ? '🎉 All tests passed! Time synchronization system is working correctly.'
  : '⚠️  Some tests failed. Please review the results and fix any issues.'
}
    `.trim()
  }

  private addResult(result: TestResult): void {
    this.results.push(result)
    console.log(`${result.passed ? '✅' : '❌'} ${result.testName}: ${result.details}`)
  }

  /**
   * Clear test results and reset state
   */
  reset(): void {
    this.results = []
    this.syncEvents = []
    this.startTime = 0
  }
}

// Export singleton instance for easy use
export const timeSyncTester = new TimeSyncTester(100) // ±100ms tolerance