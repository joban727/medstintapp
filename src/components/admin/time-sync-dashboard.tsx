'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  Activity, 
  Clock, 
  Wifi, 
  WifiOff, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Play,
  Square,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { useTimeSync } from '@/hooks/use-time-sync'
import { timeSyncTester, TimeSyncTester } from '@/utils/time-sync-test'

interface TestResults {
  passed: boolean
  accuracy: any
  performance: any
  fallbackWorking: boolean
  clockOperationsWorking: boolean
  results: any[]
  summary: string
}

export function TimeSyncDashboard() {
  const timeSync = useTimeSync()
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [testResults, setTestResults] = useState<TestResults | null>(null)
  const [testProgress, setTestProgress] = useState(0)
  const [currentTest, setCurrentTest] = useState('')

  // Get drift statistics
  const driftStats = timeSync.getDriftStatistics?.()

  // Format time with milliseconds
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString() + '.' + date.getMilliseconds().toString().padStart(3, '0')
  }

  // Get status color based on sync accuracy
  const getStatusColor = (accuracy: string) => {
    switch (accuracy) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Get drift trend icon
  const getDriftTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'stable': return <Minus className="h-4 w-4 text-blue-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  // Run comprehensive tests
  const runTests = async () => {
    setIsTestRunning(true)
    setTestProgress(0)
    setCurrentTest('Initializing tests...')
    
    try {
      const tester = new TimeSyncTester(100)
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setTestProgress(prev => Math.min(prev + 2, 95))
      }, 1000)

      setCurrentTest('Testing accuracy...')
      const results = await tester.runAllTests()
      
      clearInterval(progressInterval)
      setTestProgress(100)
      setCurrentTest('Tests completed!')
      setTestResults(results)
      
    } catch (error) {
      console.error('Test execution failed:', error)
      setCurrentTest('Tests failed!')
    } finally {
      setIsTestRunning(false)
      setTimeout(() => {
        setTestProgress(0)
        setCurrentTest('')
      }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Synchronization Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and test real-time synchronization performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={timeSync.reconnect}
            variant="outline"
            size="sm"
            disabled={isTestRunning}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reconnect
          </Button>
          <Button
            onClick={runTests}
            disabled={isTestRunning}
            className="min-w-[120px]"
          >
            {isTestRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Tests
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Status</CardTitle>
            {timeSync.isConnected ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {timeSync.isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-muted-foreground">
              Protocol: {timeSync.protocol?.toUpperCase() || 'None'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sync Accuracy</CardTitle>
            <Activity className={`h-4 w-4 ${getStatusColor(timeSync.syncAccuracy)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {timeSync.syncAccuracy}
            </div>
            <p className="text-xs text-muted-foreground">
              Drift: {timeSync.driftMs.toFixed(1)}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {timeSync.serverTime ? formatTime(timeSync.serverTime) : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Corrected: {formatTime(timeSync.getCorrectedTimestamp())}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drift Trend</CardTitle>
            {getDriftTrendIcon(timeSync.driftTrend)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {timeSync.driftTrend}
            </div>
            <p className="text-xs text-muted-foreground">
              Corrections: {timeSync.correctionCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Progress */}
      {isTestRunning && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Running Tests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{currentTest}</span>
                <span>{testProgress}%</span>
              </div>
              <Progress value={testProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
          <TabsTrigger value="tests">Test Results</TabsTrigger>
          <TabsTrigger value="logs">Event Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Status</CardTitle>
                <CardDescription>Real-time synchronization metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Client ID:</span>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {timeSync.clientId || 'Not assigned'}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span>Protocol:</span>
                  <Badge variant={timeSync.protocol === 'sse' ? 'default' : 'secondary'}>
                    {timeSync.protocol?.toUpperCase() || 'None'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Drift:</span>
                  <span className={timeSync.driftMs > 100 ? 'text-red-600' : 'text-green-600'}>
                    {timeSync.driftMs.toFixed(2)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Average Drift:</span>
                  <span>{timeSync.averageDrift.toFixed(2)}ms</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Session Statistics</CardTitle>
                <CardDescription>Current session metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeSync.stats ? (
                  <>
                    <div className="flex justify-between">
                      <span>Session Active:</span>
                      <Badge variant={timeSync.stats.sessionActive ? 'default' : 'secondary'}>
                        {timeSync.stats.sessionActive ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Recent Events:</span>
                      <span>{timeSync.stats.recentEventCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Sync:</span>
                      <span className="text-sm">
                        {timeSync.stats.lastSync 
                          ? new Date(timeSync.stats.lastSync).toLocaleTimeString()
                          : 'Never'
                        }
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No session data available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {timeSync.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{timeSync.error}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drift Statistics</CardTitle>
              <CardDescription>Historical drift analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {driftStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{driftStats.count}</div>
                    <div className="text-sm text-muted-foreground">Measurements</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{driftStats.average.toFixed(1)}ms</div>
                    <div className="text-sm text-muted-foreground">Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{driftStats.stdDev.toFixed(1)}ms</div>
                    <div className="text-sm text-muted-foreground">Std Dev</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{driftStats.max.toFixed(1)}ms</div>
                    <div className="text-sm text-muted-foreground">Max Drift</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No drift statistics available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          {testResults ? (
            <>
              <Alert variant={testResults.passed ? "default" : "destructive"}>
                {testResults.passed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  Test Results: {testResults.passed ? 'PASSED' : 'FAILED'}
                </AlertTitle>
                <AlertDescription>
                  {testResults.passed 
                    ? 'All synchronization tests completed successfully'
                    : 'Some tests failed. Review the detailed results below.'
                  }
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Accuracy Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Average Drift:</span>
                      <span>{testResults.accuracy.averageDrift.toFixed(2)}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Drift:</span>
                      <span className={testResults.accuracy.maxDrift > 100 ? 'text-red-600' : 'text-green-600'}>
                        {testResults.accuracy.maxDrift.toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Within ±100ms:</span>
                      <Badge variant={testResults.accuracy.withinTolerance ? 'default' : 'destructive'}>
                        {testResults.accuracy.withinTolerance ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Connection Time:</span>
                      <span>{testResults.performance.connectionTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>First Sync:</span>
                      <span>{testResults.performance.firstSyncTime}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Latency:</span>
                      <span>{testResults.performance.averageLatency.toFixed(2)}ms</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {testResults.results.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          {result.passed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="font-medium">{result.testName}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {result.details}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Summary Report</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                    {testResults.summary}
                  </pre>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground mb-4">No test results available</p>
                <Button onClick={runTests} disabled={isTestRunning}>
                  <Play className="h-4 w-4 mr-2" />
                  Run Tests
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Logs</CardTitle>
              <CardDescription>Real-time synchronization events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Event logging will be implemented in a future update
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}