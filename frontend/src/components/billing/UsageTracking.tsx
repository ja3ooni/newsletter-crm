'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import { useBillingStore } from '@/store/billingStore'
import { UsageTrackingData } from '@/types/billing'
import {
  Activity,
  AlertTriangle,
  Mail,
  RefreshCw,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

interface UsageTrackingProps {
  subscriptionId: string
  usageData: UsageTrackingData[]
  isLoading: boolean
  detailed?: boolean
}

export default function UsageTracking({
  subscriptionId,
  usageData,
  isLoading,
  detailed = false
}: UsageTrackingProps): JSX.Element {
  const [selectedMetric, setSelectedMetric] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  const { fetchUsageTracking } = useBillingStore()

  useEffect(() => {
    if (detailed && subscriptionId) {
      loadUsageHistory()
    }
  }, [detailed, subscriptionId, selectedMetric, timeRange])

  const loadUsageHistory = async () => {
    setIsLoadingHistory(true)
    try {
      // This would typically call an API to get historical usage data
      // For now, we'll simulate some data
      const mockHistory = generateMockUsageHistory()
      setUsageHistory(mockHistory)
    } catch (error) {
      console.error('Failed to load usage history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const generateMockUsageHistory = () => {
    const days = parseInt(timeRange.replace('d', ''))
    const data = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      data.push({
        date: date.toISOString().split('T')[0],
        newsletters: Math.floor(Math.random() * 10) + 1,
        emails: Math.floor(Math.random() * 1000) + 100,
        subscribers: Math.floor(Math.random() * 50) + 10,
        automations: Math.floor(Math.random() * 5) + 1,
      })
    }

    return data
  }

  const getUsageIcon = (metricName: string) => {
    switch (metricName.toLowerCase()) {
      case 'newsletters':
        return <Mail className="h-4 w-4" aria-hidden="true" />
      case 'subscribers':
        return <Users className="h-4 w-4" aria-hidden="true" />
      case 'emails':
      case 'emailspermonth':
        return <Mail className="h-4 w-4" aria-hidden="true" />
      case 'automations':
        return <Zap className="h-4 w-4" aria-hidden="true" />
      default:
        return <Activity className="h-4 w-4" aria-hidden="true" />
    }
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-green-600'
  }



  const handleRefreshUsage = async () => {
    await fetchUsageTracking(subscriptionId)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" aria-label="Loading usage tracking title" />
          <Skeleton className="h-4 w-1/2" aria-label="Loading usage tracking description" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="status" aria-live="polite" aria-label="Loading usage metrics">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" aria-label={`Loading metric ${i} name`} />
                <Skeleton className="h-2 w-full" aria-label={`Loading metric ${i} progress bar`} />
                <Skeleton className="h-3 w-1/2" aria-label={`Loading metric ${i} details`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" aria-hidden="true" />
                Usage Tracking
              </CardTitle>
              <CardDescription>
                Monitor your current usage against plan limits
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshUsage}
              aria-label="Refresh usage data"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {usageData.length === 0 ? (
            <div className="text-center py-8" role="status" aria-live="polite">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <p className="text-muted-foreground">No usage data available</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Usage metrics">
              {usageData.map((usage) => {
                const metricLabel = usage.metricName.replace(/([A-Z])/g, ' $1').trim();
                const usageStatus = usage.percentage >= 90 ? 'high usage' : usage.percentage >= 75 ? 'moderate usage' : 'normal usage';

                return (
                  <div key={usage.metricName} className="space-y-2" role="group" aria-labelledby={`metric-${usage.metricName}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getUsageIcon(usage.metricName)}
                        <span id={`metric-${usage.metricName}`} className="font-medium capitalize">
                          {metricLabel}
                        </span>
                      </div>
                      {usage.percentage >= 90 && (
                        <Badge variant="error" className="text-xs" role="alert" aria-label={`Warning: ${metricLabel} usage is high at ${usage.percentage.toFixed(1)}%`}>
                          <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                          High
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={getUsageColor(usage.percentage)} aria-label={`${metricLabel}: ${usage.currentUsage.toLocaleString()} used of ${usage.limit === -1 ? 'unlimited' : usage.limit.toLocaleString()} limit`}>
                          {usage.currentUsage.toLocaleString()} / {usage.limit === -1 ? '∞' : usage.limit.toLocaleString()}
                        </span>
                        <span className={`font-medium ${getUsageColor(usage.percentage)}`} aria-label={`${usage.percentage.toFixed(1)} percent used, ${usageStatus}`}>
                          {usage.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, usage.percentage)}
                        className="h-2"
                        aria-label={`${metricLabel} usage: ${usage.percentage.toFixed(1)}% of limit`}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground" aria-label={`Usage resets on ${formatDate(usage.resetDate)}`}>
                      Resets {formatDate(usage.resetDate)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {detailed && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                  Usage History
                </CardTitle>
                <CardDescription>
                  Track your usage patterns over time
                </CardDescription>
              </div>
              <div className="flex items-center gap-2" role="group" aria-label="Chart filters">
                <Select
                  id="metric-select"
                  label="Select metric to display"
                  className="w-40"
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Metrics' },
                    { value: 'newsletters', label: 'Newsletters' },
                    { value: 'emails', label: 'Emails' },
                    { value: 'subscribers', label: 'Subscribers' },
                    { value: 'automations', label: 'Automations' }
                  ]}
                />
                <Select
                  id="timerange-select"
                  label="Select time range"
                  className="w-32"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  options={[
                    { value: '7d', label: '7 days' },
                    { value: '30d', label: '30 days' },
                    { value: '90d', label: '90 days' }
                  ]}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="h-80 flex items-center justify-center" role="status" aria-live="polite">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" aria-hidden="true" />
                  <p className="text-muted-foreground">Loading usage history...</p>
                </div>
              </div>
            ) : (
              <div className="h-80" role="img" aria-label={`Usage history chart showing ${selectedMetric === 'all' ? 'all metrics' : selectedMetric} over ${timeRange}`}>
                <ResponsiveContainer width="100%" height="100%">
                  {selectedMetric === 'all' ? (
                    <AreaChart data={usageHistory} aria-label="Stacked area chart showing usage trends for all metrics">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        aria-label="Date axis"
                      />
                      <YAxis aria-label="Usage count axis" />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value, name) => [value, name]}
                      />
                      <Area
                        type="monotone"
                        dataKey="newsletters"
                        stackId="1"
                        stroke="#8884d8"
                        fill="#8884d8"
                        name="Newsletters"
                      />
                      <Area
                        type="monotone"
                        dataKey="emails"
                        stackId="1"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        name="Emails"
                      />
                      <Area
                        type="monotone"
                        dataKey="subscribers"
                        stackId="1"
                        stroke="#ffc658"
                        fill="#ffc658"
                        name="Subscribers"
                      />
                      <Area
                        type="monotone"
                        dataKey="automations"
                        stackId="1"
                        stroke="#ff7300"
                        fill="#ff7300"
                        name="Automations"
                      />
                    </AreaChart>
                  ) : (
                    <LineChart data={usageHistory} aria-label={`Line chart showing ${selectedMetric} usage trend`}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        aria-label="Date axis"
                      />
                      <YAxis aria-label="Usage count axis" />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value, name) => [value, name]}
                      />
                      <Line
                        type="monotone"
                        dataKey={selectedMetric}
                        stroke="#8884d8"
                        strokeWidth={2}
                        name={selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
                {/* Screen reader accessible chart description */}
                <div className="sr-only">
                  Chart showing usage data for {selectedMetric === 'all' ? 'all metrics including newsletters, emails, subscribers, and automations' : selectedMetric}
                  over the past {timeRange}.
                  {usageHistory.length > 0 && (
                    <>
                      Data ranges from {new Date(usageHistory[0]?.date).toLocaleDateString()}
                      to {new Date(usageHistory[usageHistory.length - 1]?.date).toLocaleDateString()}.
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
