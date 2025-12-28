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
    Zap,
    Server,
    Globe,
    Monitor,
} from 'lucide-react'
import { useTimeSync } from '@/hooks/use-time-sync'
import { toast } from 'sonner'

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
    const { isConnected, syncAccuracy: accuracy, driftMs: drift, protocol } = useTimeSync()
    // const syncStatus = useSyncStatus() // Removed as it's not exported
    const [metrics, setMetrics] = useState<SyncMetrics | null>(null)
    const connectionHealth = metrics?.connectionHealth ?? (isConnected ? 100 : 0)
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [autoRefresh, setAutoRefresh] = useState(true)

    // Fetch sync status and metrics
    const fetchSyncStatus = async () => {
        try {
            setIsRefreshing(true)
            const response = await fetch('/api/time-sync/sync-status')
            const data = await response.json().catch((err) => {
                console.error('Failed to parse JSON response:', err)
                throw new Error('Invalid response format')
            })

            if (data.success) {
                setMetrics({
                    qualityScore: data.data.qualityScore,
                    uptime: data.data.uptime,
                    syncCount: data.data.syncCount,
                    errorCount: data.data.errorCount,
                    averageDrift: Math.abs(data.data.drift),
                    connectionHealth: data.data.connectionHealth,
                    lastSyncTime: data.data.lastSyncTime,
                    recommendations: data.data.recommendations,
                })
                setSystemInfo(data.data.systemInfo)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
            console.error('[TimeSyncMonitor] Operation failed:', error)
            toast.error(errorMessage)
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
        const errorRate = metrics
            ? (metrics.errorCount / Math.max(metrics.syncCount, 1)) * 100
            : 0
        return {
            overall:
                qualityScore >= 80
                    ? 'excellent'
                    : qualityScore >= 60
                        ? 'good'
                        : qualityScore >= 40
                            ? 'fair'
                            : 'poor',
            connection: isConnected ? 'connected' : 'disconnected',
            accuracy:
                accuracy === 'high'
                    ? 'excellent'
                    : accuracy === 'medium'
                        ? 'good'
                        : 'poor',
            drift:
                drift < 100
                    ? 'excellent'
                    : drift < 500
                        ? 'good'
                        : drift < 1000
                            ? 'fair'
                            : 'poor',
            errorRate:
                errorRate < 1
                    ? 'excellent'
                    : errorRate < 5
                        ? 'good'
                        : errorRate < 10
                            ? 'fair'
                            : 'poor',
        }
    }, [metrics, isConnected, accuracy, drift])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'excellent':
                return 'text-healthcare-green dark:text-green-400'
            case 'good':
                return 'text-medical-primary dark:text-blue-400'
            case 'fair':
                return 'text-yellow-600 dark:text-yellow-400'
            case 'poor':
                return 'text-error dark:text-red-400'
            case 'connected':
                return 'text-healthcare-green dark:text-green-400'
            case 'disconnected':
                return 'text-error dark:text-red-400'
            default:
                return 'text-gray-600 dark:text-gray-400'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'excellent':
            case 'good':
            case 'connected':
                return <CheckCircle className="w-4 h-4" />
            case 'fair':
                return <AlertTriangle className="w-4 h-4" />
            case 'poor':
            case 'disconnected':
                return <XCircle className="w-4 h-4" />
            default:
                return <Activity className="w-4 h-4" />
        }
    }

    const formatUptime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        return `${hours}h ${minutes}m`
    }

    return (
        <div className="gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 text-medical-primary dark:text-blue-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Time Synchronization Monitor
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Real-time monitoring and diagnostics
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={
                            autoRefresh ? 'bg-green-50 border-green-200 text-green-700' : ''
                        }
                    >
                        <Activity className="w-4 h-4 mr-2" />
                        Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchSyncStatus}
                        disabled={isRefreshing}
                    >
                        <RefreshCw
                            className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Connection Status
                                </p>
                                <div
                                    className={`flex items-center gap-2 mt-1 ${getStatusColor(
                                        statusIndicators.connection
                                    )}`}
                                >
                                    {isConnected ? (
                                        <Wifi className="w-4 h-4" />
                                    ) : (
                                        <WifiOff className="w-4 h-4" />
                                    )}
                                    <span className="font-semibold">
                                        {isConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                </div>
                            </div>
                            {getStatusIcon(statusIndicators.connection)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Sync Quality
                                </p>
                                <div
                                    className={`flex items-center gap-2 mt-1 ${getStatusColor(
                                        statusIndicators.overall
                                    )}`}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="font-semibold">
                                        {metrics?.qualityScore || 0}%
                                    </span>
                                </div>
                            </div>
                            {getStatusIcon(statusIndicators.overall)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Time Drift
                                </p>
                                <div
                                    className={`flex items-center gap-2 mt-1 ${getStatusColor(
                                        statusIndicators.drift
                                    )}`}
                                >
                                    <Zap className="w-4 h-4" />
                                    <span className="font-semibold"> {drift}ms </span>
                                </div>
                            </div>
                            {getStatusIcon(statusIndicators.drift)}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Protocol
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-medical-primary dark:text-blue-400">
                                    <Globe className="w-4 h-4" />
                                    <span className="font-semibold uppercase"> {protocol} </span>
                                </div>
                            </div>
                            <Server className="w-4 h-4 text-gray-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Monitoring Tabs */}
            <Tabs defaultValue="metrics" className="gap-4">
                <TabsList>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="health">Health</TabsTrigger>
                    <TabsTrigger value="system">System Info</TabsTrigger>
                    <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                </TabsList>

                <TabsContent value="metrics" className="gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="w-5 h-5" />
                                    <span>Performance Metrics</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Sync Count</span>
                                    <Badge variant="secondary">{metrics?.syncCount || 0}</Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Error Count</span>
                                    <Badge
                                        variant={
                                            metrics?.errorCount ? 'destructive' : 'secondary'
                                        }
                                    >
                                        {' '}
                                        {metrics?.errorCount || 0}{' '}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Uptime</span>
                                    <Badge variant="secondary">
                                        {' '}
                                        {metrics ? formatUptime(metrics.uptime) : '0h 0m'}{' '}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">Last Sync</span>
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {' '}
                                        {metrics?.lastSyncTime
                                            ? new Date(metrics.lastSyncTime).toLocaleTimeString()
                                            : 'Never'}{' '}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5" />
                                    <span>Accuracy & Drift</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="gap-4">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">Accuracy Level</span>
                                        <Badge
                                            variant={
                                                accuracy === 'high'
                                                    ? 'default'
                                                    : accuracy === 'medium'
                                                        ? 'secondary'
                                                        : 'destructive'
                                            }
                                        >
                                            {' '}
                                            {accuracy}{' '}
                                        </Badge>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">Current Drift</span>
                                        <span className="text-sm font-semibold">{drift}ms</span>
                                    </div>
                                    <Progress
                                        value={Math.min((drift / 1000) * 100, 100)}
                                        className="h-2"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">
                                            Connection Health
                                        </span>
                                        <span className="text-sm font-semibold">
                                            {connectionHealth}%
                                        </span>
                                    </div>
                                    <Progress value={connectionHealth} className="h-2" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="health" className="gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Monitor className="w-5 h-5" />
                                <span>System Health Overview</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Overall Status</span>
                                        <div
                                            className={`flex items-center gap-1 ${getStatusColor(
                                                statusIndicators.overall
                                            )}`}
                                        >
                                            {' '}
                                            {getStatusIcon(statusIndicators.overall)}{' '}
                                            <span className="text-sm font-semibold capitalize">
                                                {' '}
                                                {statusIndicators.overall}{' '}
                                            </span>{' '}
                                        </div>
                                    </div>
                                    <Progress
                                        value={metrics?.qualityScore || 0}
                                        className="h-2"
                                    />
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Connection</span>
                                        <div
                                            className={`flex items-center gap-1 ${getStatusColor(
                                                statusIndicators.connection
                                            )}`}
                                        >
                                            {' '}
                                            {getStatusIcon(statusIndicators.connection)}{' '}
                                            <span className="text-sm font-semibold capitalize">
                                                {' '}
                                                {statusIndicators.connection}{' '}
                                            </span>{' '}
                                        </div>
                                    </div>
                                    <Progress
                                        value={isConnected ? 100 : 0}
                                        className="h-2"
                                    />
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Accuracy</span>
                                        <div
                                            className={`flex items-center gap-1 ${getStatusColor(
                                                statusIndicators.accuracy
                                            )}`}
                                        >
                                            {' '}
                                            {getStatusIcon(statusIndicators.accuracy)}{' '}
                                            <span className="text-sm font-semibold capitalize">
                                                {' '}
                                                {statusIndicators.accuracy}{' '}
                                            </span>{' '}
                                        </div>
                                    </div>
                                    <Progress
                                        value={
                                            accuracy === 'high'
                                                ? 100
                                                : accuracy === 'medium'
                                                    ? 70
                                                    : 30
                                        }
                                        className="h-2"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="system" className="gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5" />
                                <span>System Information</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {' '}
                            {systemInfo ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="gap-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                {' '}
                                                Timezone{' '}
                                            </span>
                                            <span className="text-sm font-semibold">
                                                {systemInfo.timezone}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                {' '}
                                                Locale{' '}
                                            </span>
                                            <span className="text-sm font-semibold">
                                                {systemInfo.locale}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="gap-3">
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                {' '}
                                                Platform{' '}
                                            </span>
                                            <span className="text-sm font-semibold">
                                                {systemInfo.platform}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                                {' '}
                                                Node Version{' '}
                                            </span>
                                            <span className="text-sm font-semibold">
                                                {systemInfo.nodeVersion}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    {' '}
                                    Loading system information...{' '}
                                </div>
                            )}{' '}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="recommendations" className="gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                <span>System Recommendations</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {' '}
                            {metrics?.recommendations && metrics.recommendations.length > 0 ? (
                                <div className="gap-3">
                                    {' '}
                                    {metrics.recommendations.map((recommendation, index) => (
                                        <div
                                            key={index}
                                            className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                                        >
                                            <AlertTriangle className="w-4 h-4 text-medical-primary dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-blue-800 dark:text-blue-200">
                                                {' '}
                                                {recommendation}{' '}
                                            </span>
                                        </div>
                                    ))}{' '}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                    <p className="text-healthcare-green dark:text-green-400 font-medium">
                                        {' '}
                                        All systems operating optimally{' '}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {' '}
                                        No recommendations at this time{' '}
                                    </p>
                                </div>
                            )}{' '}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default TimeSyncMonitor