'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

interface KPIMetric {
  name: string
  value: string | number
  growth: number
  format: 'number' | 'percentage' | 'currency'
  trend: 'up' | 'down' | 'stable'
}

interface ExecutiveSummary {
  summary: string
  keyMetrics: KPIMetric[]
  recommendations: string[]
}

interface ChartData {
  title: string
  type: 'line' | 'bar' | 'pie'
  data: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string[]
      borderColor?: string
    }>
  }
}

interface ExecutiveDashboardProps {
  className?: string
}

const TIME_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
]

export function ExecutiveDashboard({ className }: ExecutiveDashboardProps): JSX.Element {
  const [timeRange, setTimeRange] = useState('30d')
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchExecutiveSummary = useCallback(async () => {
    try {
      setLoading(true)

      // In a real implementation, this would call the API
      // const response = await fetch(`/api/v1/analytics/executive-summary?timeRange=${timeRange}`)
      // const data = await response.json()

      // Mock data for demonstration
      const mockSummary: ExecutiveSummary = {
        summary: `During the last ${timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : timeRange === '90d' ? '90 days' : 'year'}, your newsletter platform achieved strong performance with 1,250 total subscribers and an average open rate of 28.5%. Click rates show excellent engagement at 4.2%, indicating high content relevance. Total revenue generated was $15,750 with a positive growth rate of 5.2%.`,
        keyMetrics: [
          {
            name: 'Total Subscribers',
            value: '1,250',
            growth: 5.2,
            format: 'number',
            trend: 'up',
          },
          {
            name: 'Open Rate',
            value: 28.5,
            growth: 2.3,
            format: 'percentage',
            trend: 'up',
          },
          {
            name: 'Click Rate',
            value: 4.2,
            growth: 0.8,
            format: 'percentage',
            trend: 'up',
          },
          {
            name: 'Revenue',
            value: 15750,
            growth: 12.5,
            format: 'currency',
            trend: 'up',
          },
          {
            name: 'Newsletters Sent',
            value: '45',
            growth: 0,
            format: 'number',
            trend: 'stable',
          },
          {
            name: 'Conversion Rate',
            value: 2.8,
            growth: 1.2,
            format: 'percentage',
            trend: 'up',
          },
        ],
        recommendations: [
          '📈 Excellent performance: Your open rates are performing above industry average (25%)',
          '🎯 Strong engagement: Your click rates indicate excellent content relevance',
          '📊 Positive growth: Subscriber growth is strong at 5.2% this period',
          '💰 High value: Revenue per subscriber indicates strong monetization',
          '🌟 Highly engaged audience: Your subscribers are very active',
          'Consider A/B testing subject lines to improve open rates further',
          'Implement segmentation to deliver more personalized content',
          'Monitor subscriber engagement patterns for churn prevention',
        ],
      }

      const mockChartData: ChartData[] = [
        {
          title: 'Subscriber Growth Trend',
          type: 'line',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [
              {
                label: 'New Subscribers',
                data: [45, 52, 38, 65],
                borderColor: '#3B82F6',
              },
              {
                label: 'Total Subscribers',
                data: [1150, 1202, 1240, 1305],
                borderColor: '#10B981',
              },
            ],
          },
        },
        {
          title: 'Engagement Metrics',
          type: 'bar',
          data: {
            labels: ['Opens', 'Clicks', 'Conversions', 'Unsubscribes'],
            datasets: [
              {
                label: 'This Period',
                data: [356, 52, 14, 3],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
              },
            ],
          },
        },
        {
          title: 'Revenue Sources',
          type: 'pie',
          data: {
            labels: ['Email Campaigns', 'Direct Traffic', 'Social Media', 'Referrals'],
            datasets: [
              {
                label: 'Revenue',
                data: [8500, 4200, 2100, 950],
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
              },
            ],
          },
        },
      ]

      setExecutiveSummary(mockSummary)
      setChartData(mockChartData)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch executive summary:', error)
      toast.error('Failed to load executive summary')
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchExecutiveSummary()
  }, [fetchExecutiveSummary])

  const formatValue = (value: string | number, format: string): string => {
    if (typeof value === 'string') return value

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)
      case 'percentage':
        return `${value}%`
      case 'number':
      default:
        return value.toLocaleString()
    }
  }

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up':
        return '📈'
      case 'down':
        return '📉'
      case 'stable':
      default:
        return '➡️'
    }
  }

  const getTrendColor = (trend: string): string => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'stable':
      default:
        return 'text-gray-600'
    }
  }

  const exportSummary = useCallback(async (format: 'pdf' | 'excel') => {
    try {
      // In a real implementation, this would call the API
      toast.success(`Executive summary exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error(`Failed to export as ${format.toUpperCase()}`)
    }
  }, [])

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-500 text-sm">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            options={TIME_RANGES}
          />
          <Button
            variant="outline"
            onClick={() => exportSummary('pdf')}
          >
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => exportSummary('excel')}
          >
            Export Excel
          </Button>
          <Button onClick={fetchExecutiveSummary}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      {executiveSummary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {executiveSummary.keyMetrics.map((metric, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatValue(metric.value, metric.format)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1">
                      <span className="text-lg">{getTrendIcon(metric.trend)}</span>
                      <span className={`text-sm font-medium ${getTrendColor(metric.trend)}`}>
                        {metric.growth > 0 ? '+' : ''}{metric.growth}%
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Executive Summary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Executive Summary</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              {executiveSummary.summary}
            </p>

            <h3 className="text-md font-semibold text-gray-900 mb-3">Key Insights & Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {executiveSummary.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">{recommendation}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartData.map((chart, index) => (
              <Card key={index} className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{chart.title}</h3>
                <div className="bg-gray-100 rounded-lg p-6 h-64 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-2">
                      {chart.type === 'line' ? '📈' : chart.type === 'bar' ? '📊' : '🥧'}
                    </div>
                    <div className="text-gray-600">{chart.title}</div>
                    <div className="text-sm text-gray-500 mt-2">
                      {chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart visualization
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
