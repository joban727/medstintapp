/**
 * Time Synchronization Administrative Monitor
 * 
 * Provides comprehensive monitoring interface for time sync status,
 * connection health, and system diagnostics.
 */

import type React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Clock, 
  Wifi, 
  WifiOff, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Server,
  Globe,
  Monitor
} from 'lucide-react'
import { useTimeSync, useSyncStatus } from '@/hooks/useTimeSync'
import { useEnhancedTheme } from '@/hooks/useEnhancedTheme'

interface SyncMetrics {
  qualityScore: number
  uptime: number
  syncCount: number
  errorCount: number
  averageDrift: number
  connectionHealth: number
  lastSyncTime: string | null
  recommendations: string[]
}

interface SystemInfo {
  timezone: string
  locale: string
  platform: string
  nodeVersion: string
}

export const TimeSyncMonitor: React.FC = () => {
  const { theme } = useEnhancedTheme()
  const { isConnected, accuracy, drift, protocol, connectionHealth } = useTimeSync()
  const syncStatus = useSyncStatus()
  
  const [metrics, setMetrics] = useState&lt;SyncMetrics | null&gt;(null)
  const [systemInfo, setSystemInfo] = useState&lt;SystemInfo | null&gt;(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Fetch sync status and metrics
  const fetchSyncStatus = async () => {
    try {
      setIsRefreshing(true)
      const response = await fetch('/api/time-sync/sync-status')
      const data = await response.json()
      
      if (data.success) {
        setMetrics({
          qualityScore: data.data.qualityScore,
          uptime: data.data.uptime,
          syncCount: data.data.syncCount,
          errorCount: data.data.errorCount,
          averageDrift: Math.abs(data.data.drift),
          connectionHealth: data.data.connectionHealth,
          lastSyncTime: data.data.lastSyncTime,
          recommendations: data.data.recommendations
        })
        
        setSystemInfo(data.data.systemInfo)
      }
    } catch (error) {
      console.error('Failed to fetch sync status:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    fetchSyncStatus()
    
    if (autoRefresh) {
      const interval = setInterval(fetchSyncStatus, 5000) // Refresh every 5 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  // Calculate status indicators
  const statusIndicators = useMemo(() => {
    const qualityScore = metrics?.qualityScore || 0
    const errorRate = metrics ? (metrics.errorCount / Math.max(metrics.syncCount, 1)) * 100 : 0
    
    return {
      overall: qualityScore >= 80 ? 'excellent' : qualityScore >= 60 ? 'good' : qualityScore >= 40 ? 'fair' : 'poor',
      connection: isConnected ? 'connected' : 'disconnected',
      accuracy: accuracy === 'high' ? 'excellent' : accuracy === 'medium' ? 'good' : 'poor',
      drift: drift < 100 ? 'excellent' : drift < 500 ? 'good' : drift < 1000 ? 'fair' : 'poor',
      errorRate: errorRate < 1 ? 'excellent' : errorRate < 5 ? 'good' : errorRate < 10 ? 'fair' : 'poor'
    }
  }, [metrics, isConnected, accuracy, drift])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 dark:text-green-400'
      case 'good': return 'text-blue-600 dark:text-blue-400'
      case 'fair': return 'text-yellow-600 dark:text-yellow-400'
      case 'poor': return 'text-red-600 dark:text-red-400'
      case 'connected': return 'text-green-600 dark:text-green-400'
      case 'disconnected': return 'text-red-600 dark:text-red-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
      case 'connected':
        return &lt;CheckCircle className="w-4 h-4" /&gt;
      case 'fair':
        return &lt;AlertTriangle className="w-4 h-4" /&gt;
      case 'poor':
      case 'disconnected':
        return &lt;XCircle className="w-4 h-4" /&gt;
      default:
        return &lt;Activity className="w-4 h-4" /&gt;
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  return (
    &lt;div className="space-y-6"&gt;
      &lt;div className="flex items-center justify-between"&gt;
        &lt;div className="flex items-center space-x-3"&gt;
          &lt;Clock className="w-8 h-8 text-blue-600 dark:text-blue-400" /&gt;
          &lt;div&gt;
            &lt;h1 className="text-2xl font-bold text-gray-900 dark:text-white"&gt;
              Time Synchronization Monitor
            &lt;/h1&gt;
            &lt;p className="text-gray-600 dark:text-gray-400"&gt;
              Real-time monitoring and diagnostics
            &lt;/p&gt;
          &lt;/div&gt;
        &lt;/div&gt;
        
        &lt;div className="flex items-center space-x-3"&gt;
          &lt;Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200 text-green-700' : ''}
          &gt;
            &lt;Activity className="w-4 h-4 mr-2" /&gt;
            Auto Refresh autoRefresh ? 'ON' : 'OFF'
          &lt;/Button&gt;
          
          &lt;Button
            variant="outline"
            size="sm"
            onClick={fetchSyncStatus}
            disabled={isRefreshing}
          &gt;
            &lt;RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /&gt;
            Refresh
          &lt;/Button&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      {/* Status Overview Cards */}
      &lt;div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"&gt;
        &lt;Card&gt;
          &lt;CardContent className="p-4"&gt;
            &lt;div className="flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;p className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                  Connection Status
                &lt;/p&gt;
                &lt;div className={`flex items-center space-x-2 mt-1 $getStatusColor(statusIndicators.connection)`}&gt;
                  {isConnected ? &lt;Wifi className="w-4 h-4" /&gt; : &lt;WifiOff className="w-4 h-4" /&gt;}
                  &lt;span className="font-semibold"&gt;
                    {isConnected ? 'Connected' : 'Disconnected'}
                  &lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
              {getStatusIcon(statusIndicators.connection)}
            &lt;/div&gt;
          &lt;/CardContent&gt;
        &lt;/Card&gt;

        &lt;Card&gt;
          &lt;CardContent className="p-4"&gt;
            &lt;div className="flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;p className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                  Sync Quality
                &lt;/p&gt;
                &lt;div className={`flex items-center space-x-2 mt-1 $getStatusColor(statusIndicators.overall)`}&gt;
                  &lt;TrendingUp className="w-4 h-4" /&gt;
                  &lt;span className="font-semibold"&gt;
                    {metrics?.qualityScore || 0}%
                  &lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
              {getStatusIcon(statusIndicators.overall)}
            &lt;/div&gt;
          &lt;/CardContent&gt;
        &lt;/Card&gt;

        &lt;Card&gt;
          &lt;CardContent className="p-4"&gt;
            &lt;div className="flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;p className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                  Time Drift
                &lt;/p&gt;
                &lt;div className={`flex items-center space-x-2 mt-1 $getStatusColor(statusIndicators.drift)`}&gt;
                  &lt;Zap className="w-4 h-4" /&gt;
                  &lt;span className="font-semibold"&gt;
                    {drift}ms
                  &lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
              {getStatusIcon(statusIndicators.drift)}
            &lt;/div&gt;
          &lt;/CardContent&gt;
        &lt;/Card&gt;

        &lt;Card&gt;
          &lt;CardContent className="p-4"&gt;
            &lt;div className="flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;p className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                  Protocol
                &lt;/p&gt;
                &lt;div className="flex items-center space-x-2 mt-1 text-blue-600 dark:text-blue-400"&gt;
                  &lt;Globe className="w-4 h-4" /&gt;
                  &lt;span className="font-semibold uppercase"&gt;
                    {protocol}
                  &lt;/span&gt;
                &lt;/div&gt;
              &lt;/div&gt;
              &lt;Server className="w-4 h-4 text-gray-400" /&gt;
            &lt;/div&gt;
          &lt;/CardContent&gt;
        &lt;/Card&gt;
      &lt;/div&gt;

      {/* Detailed Monitoring Tabs */}
      &lt;Tabs defaultValue="metrics" className="space-y-4"&gt;
        &lt;TabsList&gt;
          &lt;TabsTrigger value="metrics"&gt;Metrics&lt;/TabsTrigger&gt;
          &lt;TabsTrigger value="health"&gt;Health&lt;/TabsTrigger&gt;
          &lt;TabsTrigger value="system"&gt;System Info&lt;/TabsTrigger&gt;
          &lt;TabsTrigger value="recommendations"&gt;Recommendations&lt;/TabsTrigger&gt;
        &lt;/TabsList&gt;

        &lt;TabsContent value="metrics" className="space-y-4"&gt;
          &lt;div className="grid grid-cols-1 lg:grid-cols-2 gap-6"&gt;
            &lt;Card&gt;
              &lt;CardHeader&gt;
                &lt;CardTitle className="flex items-center space-x-2"&gt;
                  &lt;Activity className="w-5 h-5" /&gt;
                  &lt;span&gt;Performance Metrics&lt;/span&gt;
                &lt;/CardTitle&gt;
              &lt;/CardHeader&gt;
              &lt;CardContent className="space-y-4"&gt;
                &lt;div className="flex justify-between items-center"&gt;
                  &lt;span className="text-sm font-medium"&gt;Sync Count&lt;/span&gt;
                  &lt;Badge variant="secondary"&gt;{metrics?.syncCount || 0}&lt;/Badge&gt;
                &lt;/div&gt;
                
                &lt;div className="flex justify-between items-center"&gt;
                  &lt;span className="text-sm font-medium"&gt;Error Count&lt;/span&gt;
                  &lt;Badge variant={metrics?.errorCount ? "destructive" : "secondary"}&gt;
                    {metrics?.errorCount || 0}
                  &lt;/Badge&gt;
                &lt;/div&gt;
                
                &lt;div className="flex justify-between items-center"&gt;
                  &lt;span className="text-sm font-medium"&gt;Uptime&lt;/span&gt;
                  &lt;Badge variant="secondary"&gt;
                    {metrics ? formatUptime(metrics.uptime) : '0h 0m'}
                  &lt;/Badge&gt;
                &lt;/div&gt;
                
                &lt;div className="flex justify-between items-center"&gt;
                  &lt;span className="text-sm font-medium"&gt;Last Sync&lt;/span&gt;
                  &lt;span className="text-sm text-gray-600 dark:text-gray-400"&gt;
                    {metrics?.lastSyncTime 
                      ? new Date(metrics.lastSyncTime).toLocaleTimeString()
                      : 'Never'
                    }
                  &lt;/span&gt;
                &lt;/div&gt;
              &lt;/CardContent&gt;
            &lt;/Card&gt;

            &lt;Card&gt;
              &lt;CardHeader&gt;
                &lt;CardTitle className="flex items-center space-x-2"&gt;
                  &lt;TrendingUp className="w-5 h-5" /&gt;
                  &lt;span&gt;Accuracy &amp; Drift&lt;/span&gt;
                &lt;/CardTitle&gt;
              &lt;/CardHeader&gt;
              &lt;CardContent className="space-y-4"&gt;
                &lt;div&gt;
                  &lt;div className="flex justify-between items-center mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Accuracy Level&lt;/span&gt;
                    &lt;Badge 
                      variant={accuracy === 'high' ? 'default' : accuracy === 'medium' ? 'secondary' : 'destructive'}
                    &gt;
                      {accuracy}
                    &lt;/Badge&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
                
                &lt;div&gt;
                  &lt;div className="flex justify-between items-center mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Current Drift&lt;/span&gt;
                    &lt;span className="text-sm font-semibold"&gt;{drift}ms&lt;/span&gt;
                  &lt;/div&gt;
                  &lt;Progress 
                    value={Math.min((drift / 1000) * 100, 100)} 
                    className="h-2"
                  /&gt;
                &lt;/div&gt;
                
                &lt;div&gt;
                  &lt;div className="flex justify-between items-center mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Connection Health&lt;/span&gt;
                    &lt;span className="text-sm font-semibold"&gt;{connectionHealth}%&lt;/span&gt;
                  &lt;/div&gt;
                  &lt;Progress value={connectionHealth} className="h-2" /&gt;
                &lt;/div&gt;
              &lt;/CardContent&gt;
            &lt;/Card&gt;
          &lt;/div&gt;
        &lt;/TabsContent&gt;

        &lt;TabsContent value="health" className="space-y-4"&gt;
          &lt;Card&gt;
            &lt;CardHeader&gt;
              &lt;CardTitle className="flex items-center space-x-2"&gt;
                &lt;Monitor className="w-5 h-5" /&gt;
                &lt;span&gt;System Health Overview&lt;/span&gt;
              &lt;/CardTitle&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent&gt;
              &lt;div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"&gt;
                &lt;div className="p-4 border rounded-lg"&gt;
                  &lt;div className="flex items-center justify-between mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Overall Status&lt;/span&gt;
                    &lt;div className={`flex items-center space-x-1 $getStatusColor(statusIndicators.overall)`}&gt;
                      {getStatusIcon(statusIndicators.overall)}
                      &lt;span className="text-sm font-semibold capitalize"&gt;
                        {statusIndicators.overall}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                  &lt;Progress value={metrics?.qualityScore || 0} className="h-2" /&gt;
                &lt;/div&gt;

                &lt;div className="p-4 border rounded-lg"&gt;
                  &lt;div className="flex items-center justify-between mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Connection&lt;/span&gt;
                    &lt;div className={`flex items-center space-x-1 $getStatusColor(statusIndicators.connection)`}&gt;
                      {getStatusIcon(statusIndicators.connection)}
                      &lt;span className="text-sm font-semibold capitalize"&gt;
                        {statusIndicators.connection}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                  &lt;Progress value={isConnected ? 100 : 0} className="h-2" /&gt;
                &lt;/div&gt;

                &lt;div className="p-4 border rounded-lg"&gt;
                  &lt;div className="flex items-center justify-between mb-2"&gt;
                    &lt;span className="text-sm font-medium"&gt;Accuracy&lt;/span&gt;
                    &lt;div className={`flex items-center space-x-1 $getStatusColor(statusIndicators.accuracy)`}&gt;
                      {getStatusIcon(statusIndicators.accuracy)}
                      &lt;span className="text-sm font-semibold capitalize"&gt;
                        {statusIndicators.accuracy}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                  &lt;Progress 
                    value={accuracy === 'high' ? 100 : accuracy === 'medium' ? 70 : 30} 
                    className="h-2" 
                  /&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            &lt;/CardContent&gt;
          &lt;/Card&gt;
        &lt;/TabsContent&gt;

        &lt;TabsContent value="system" className="space-y-4"&gt;
          &lt;Card&gt;
            &lt;CardHeader&gt;
              &lt;CardTitle className="flex items-center space-x-2"&gt;
                &lt;Server className="w-5 h-5" /&gt;
                &lt;span&gt;System Information&lt;/span&gt;
              &lt;/CardTitle&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent&gt;
              {systemInfo ? (
                &lt;div className="grid grid-cols-1 md:grid-cols-2 gap-6"&gt;
                  &lt;div className="space-y-3"&gt;
                    &lt;div className="flex justify-between"&gt;
                      &lt;span className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                        Timezone
                      &lt;/span&gt;
                      &lt;span className="text-sm font-semibold"&gt;{systemInfo.timezone}&lt;/span&gt;
                    &lt;/div&gt;
                    
                    &lt;div className="flex justify-between"&gt;
                      &lt;span className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                        Locale
                      &lt;/span&gt;
                      &lt;span className="text-sm font-semibold"&gt;{systemInfo.locale}&lt;/span&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                  
                  &lt;div className="space-y-3"&gt;
                    &lt;div className="flex justify-between"&gt;
                      &lt;span className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                        Platform
                      &lt;/span&gt;
                      &lt;span className="text-sm font-semibold"&gt;{systemInfo.platform}&lt;/span&gt;
                    &lt;/div&gt;
                    
                    &lt;div className="flex justify-between"&gt;
                      &lt;span className="text-sm font-medium text-gray-600 dark:text-gray-400"&gt;
                        Node Version
                      &lt;/span&gt;
                      &lt;span className="text-sm font-semibold"&gt;{systemInfo.nodeVersion}&lt;/span&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              ) : (
                &lt;div className="text-center py-8 text-gray-500"&gt;
                  Loading system information...
                &lt;/div&gt;
              )}
            &lt;/CardContent&gt;
          &lt;/Card&gt;
        &lt;/TabsContent&gt;

        &lt;TabsContent value="recommendations" className="space-y-4"&gt;
          &lt;Card&gt;
            &lt;CardHeader&gt;
              &lt;CardTitle className="flex items-center space-x-2"&gt;
                &lt;AlertTriangle className="w-5 h-5" /&gt;
                &lt;span&gt;System Recommendations&lt;/span&gt;
              &lt;/CardTitle&gt;
            &lt;/CardHeader&gt;
            &lt;CardContent&gt;
              {metrics?.recommendations && metrics.recommendations.length > 0 ? (
                &lt;div className="space-y-3"&gt;
                  {metrics.recommendations.map((recommendation, index) => (
                    &lt;div 
                      key={index}
                      className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    &gt;
                      &lt;AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" /&gt;
                      &lt;span className="text-sm text-blue-800 dark:text-blue-200"&gt;
                        {recommendation}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  ))}
                &lt;/div&gt;
              ) : (
                &lt;div className="text-center py-8"&gt;
                  &lt;CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" /&gt;
                  &lt;p className="text-green-600 dark:text-green-400 font-medium"&gt;
                    All systems operating optimally
                  &lt;/p&gt;
                  &lt;p className="text-sm text-gray-600 dark:text-gray-400 mt-1"&gt;
                    No recommendations at this time
                  &lt;/p&gt;
                &lt;/div&gt;
              )}
            &lt;/CardContent&gt;
          &lt;/Card&gt;
        &lt;/TabsContent&gt;
      &lt;/Tabs&gt;
    &lt;/div&gt;
  )
}

export default TimeSyncMonitor