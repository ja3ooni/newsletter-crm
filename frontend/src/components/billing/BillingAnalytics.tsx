'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BillingAnalytics as BillingAnalyticsType } from '@/types/billing'
import {
    DollarSign,
    Download,
    Percent,
    RefreshCw,
    TrendingUp,
    Users
} from 'lucide-react'
import { useState } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts'

interface BillingAnalyticsProps {
  analytics: BillingAnalyticsType | null
  isLoading: boolean
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function BillingAnalytics({ analytics, isLoading }: BillingAnalyticsProps): JSX.Element {
  const [timeRange, setTimeRange] = useState('30d')
  const [chartType, setChartType] = useState('revenue')

  const generateMockData = () => {
    const days = parseInt(timeRange.replace('d', ''))
    const data = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      data.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 5000) + 1000,
        subscriptions: Math.floor(Math.random() * 50) + 10,
        churn: Math.floor(Math.random() * 10) + 1,
        mrr: Math.floor(Math.random() * 10000) + 5000,
      })
    }

    return data
  }

  const mockData = generateMockData()

  const subscriptionData = analytics ? Object.entries(analytics.subscriptionsByPlan).map(([plan, count]) => ({
    name: plan,
    value: count,
  })) : []

  const revenueData = analytics ? Object.entries(analytics.revenueByPlan).map(([plan, revenue]) => ({
    name: plan,
    value: revenue,
  })) : []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-80 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? formatCurrency(analytics.totalRevenue / 100, 'USD') : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              All time revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? formatCurrency(analytics.monthlyRecurringRevenue / 100, 'USD') : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current MRR
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Revenue Per User</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? formatCurrency(analytics.averageRevenuePerUser / 100, 'USD') : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              ARPU
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics ? `${(analytics.churnRate * 100).toFixed(1)}%` : '0.0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly churn
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Revenue Trends
              </CardTitle>
              <CardDescription>
                Track your revenue performance over time
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="subscriptions">Subscriptions</SelectItem>
                  <SelectItem value="churn">Churn</SelectItem>
                  <SelectItem value="mrr">MRR</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis
                  tickFormatter={(value) =>
                    chartType === 'revenue' || chartType === 'mrr'
                      ? `$${(value / 100).toLocaleString()}`
                      : value.toLocaleString()
                  }
                />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: number) => [
                    chartType === 'revenue' || chartType === 'mrr'
                      ? formatCurrency(value / 100, 'USD')
                      : value.toLocaleString(),
                    chartType.toUpperCase()
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={chartType}
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Plan Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Subscriptions by Plan
            </CardTitle>
            <CardDescription>
              Distribution of active subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subscriptionData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subscriptionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {subscriptionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No subscription data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Revenue by Plan
            </CardTitle>
            <CardDescription>
              Revenue contribution by subscription plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 100).toLocaleString()}`} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value / 100, 'USD'), 'Revenue']}
                    />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Lifetime Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analytics ? formatCurrency(analytics.lifetimeValue / 100, 'USD') : '$0.00'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Average customer lifetime value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Annual Recurring Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {analytics ? formatCurrency(analytics.annualRecurringRevenue / 100, 'USD') : '$0.00'}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Projected annual revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reporting Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {analytics ? formatDate(analytics.period.start) : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">
              to {analytics ? formatDate(analytics.period.end) : 'N/A'}
            </div>
            <Button variant="outline" size="sm" className="mt-2">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
