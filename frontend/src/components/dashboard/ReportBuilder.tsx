'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { useCallback, useState } from 'react'
import { toast } from 'react-hot-toast'

interface ReportConfig {
  metrics: string[]
  dimensions: string[]
  filters: Record<string, any>
  timeRange: {
    start: Date
    end: Date
    period: 'day' | 'week' | 'month' | 'quarter' | 'year'
  }
  groupBy?: string[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  includeCharts: boolean
  includeTables: boolean
  includeExecutiveSummary: boolean
}

interface Report {
  id: string
  name: string
  description?: string
  type: 'scheduled' | 'on_demand'
  format: 'pdf' | 'csv' | 'excel' | 'json'
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly'
    dayOfWeek?: number
    dayOfMonth?: number
    time: string
    timezone: string
  }
  recipients: string[]
  config: ReportConfig
  status: 'active' | 'paused' | 'error'
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  config: Partial<ReportConfig>
}

interface ReportBuilderProps {
  report?: Report
  templates: ReportTemplate[]
  onSave: (report: Report) => void
  onCancel: () => void
}

const METRICS = [
  { value: 'engagement_rate', label: 'Engagement Rate' },
  { value: 'newsletter_performance', label: 'Newsletter Performance' },
  { value: 'subscriber_growth', label: 'Subscriber Growth' },
  { value: 'revenue_attribution', label: 'Revenue Attribution' },
  { value: 'top_content', label: 'Top Content' },
  { value: 'conversion_funnel', label: 'Conversion Funnel' },
  { value: 'cohort_analysis', label: 'Cohort Analysis' },
  { value: 'kpi_summary', label: 'KPI Summary' },
]

const DIMENSIONS = [
  { value: 'time', label: 'Time' },
  { value: 'source', label: 'Source' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'segment', label: 'Segment' },
  { value: 'content_type', label: 'Content Type' },
  { value: 'device', label: 'Device' },
  { value: 'location', label: 'Location' },
]

const FORMATS = [
  { value: 'pdf', label: 'PDF Report' },
  { value: 'excel', label: 'Excel Spreadsheet' },
  { value: 'csv', label: 'CSV Data' },
  { value: 'json', label: 'JSON Data' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

export function ReportBuilder({ report, templates, onSave, onCancel }: ReportBuilderProps): JSX.Element {
  const [currentReport, setCurrentReport] = useState<Report>(
    report || {
      id: crypto.randomUUID(),
      name: 'New Report',
      type: 'on_demand',
      format: 'pdf',
      recipients: [],
      config: {
        metrics: ['engagement_rate'],
        dimensions: ['time'],
        filters: {},
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          period: 'day',
        },
        includeCharts: true,
        includeTables: true,
        includeExecutiveSummary: true,
      },
      status: 'active',
    }
  )

  const [activeTab, setActiveTab] = useState('basic')
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)

  const handleSave = useCallback(() => {
    if (!currentReport.name.trim()) {
      toast.error('Report name is required')
      return
    }

    if (currentReport.config.metrics.length === 0) {
      toast.error('At least one metric is required')
      return
    }

    if (currentReport.type === 'scheduled' && !currentReport.schedule) {
      toast.error('Schedule configuration is required for scheduled reports')
      return
    }

    onSave(currentReport)
  }, [currentReport, onSave])

  const loadTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setCurrentReport(prev => ({
        ...prev,
        name: template.name,
        description: template.description,
        config: {
          ...prev.config,
          ...template.config,
          timeRange: template.config.timeRange || prev.config.timeRange,
        },
      }))
      toast.success('Template loaded successfully')
    }
  }, [templates])

  const generatePreview = useCallback(async () => {
    try {
      // In a real implementation, this would call the API
      const mockPreviewData = {
        summary: {
          totalSubscribers: 1250,
          totalNewsletters: 45,
          averageOpenRate: 28.5,
          averageClickRate: 4.2,
          totalRevenue: 15750.0,
        },
        charts: [
          {
            title: 'Engagement Trends',
            type: 'line',
            data: {
              labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
              datasets: [
                {
                  label: 'Opens',
                  data: [120, 135, 150, 142],
                },
                {
                  label: 'Clicks',
                  data: [25, 30, 35, 28],
                },
              ],
            },
          },
        ],
        insights: [
          '📈 Open rates are performing above industry average',
          '🎯 Click rates show strong content engagement',
          '📊 Subscriber growth is positive this period',
        ],
      }

      setPreviewData(mockPreviewData)
      setShowPreview(true)
    } catch (error) {
      toast.error('Failed to generate preview')
    }
  }, [currentReport])

  const tabs = [
    { id: 'basic', label: 'Basic Settings' },
    { id: 'data', label: 'Data Configuration' },
    { id: 'schedule', label: 'Schedule & Delivery' },
    { id: 'format', label: 'Format & Layout' },
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Input
              value={currentReport.name}
              onChange={(e) => setCurrentReport(prev => ({ ...prev, name: e.target.value }))}
              className="text-lg font-semibold border-none bg-transparent p-0 focus:ring-0"
              placeholder="Report Name"
            />
            <Select
              value=""
              onChange={loadTemplate}
              options={[
                { value: '', label: 'Load Template...' },
                ...templates.map(t => ({ value: t.id, label: t.name }))
              ]}
            />
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" onClick={generatePreview}>
              Preview
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Report
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Configuration Panel */}
        <div className="w-96 bg-white border-r border-gray-200">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            className="h-full"
          >
            {/* Basic Settings Tab */}
            {activeTab === 'basic' && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Name
                  </label>
                  <Input
                    value={currentReport.name}
                    onChange={(e) => setCurrentReport(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter report name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={currentReport.description || ''}
                    onChange={(e) => setCurrentReport(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter report description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="on_demand"
                        checked={currentReport.type === 'on_demand'}
                        onChange={(e) => setCurrentReport(prev => ({ ...prev, type: e.target.value as any }))}
                        className="mr-2"
                      />
                      On-Demand Report
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="scheduled"
                        checked={currentReport.type === 'scheduled'}
                        onChange={(e) => setCurrentReport(prev => ({ ...prev, type: e.target.value as any }))}
                        className="mr-2"
                      />
                      Scheduled Report
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={currentReport.config.timeRange.start.toISOString().split('T')[0]}
                      onChange={(e) => setCurrentReport(prev => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          timeRange: {
                            ...prev.config.timeRange,
                            start: new Date(e.target.value)
                          }
                        }
                      }))}
                    />
                    <Input
                      type="date"
                      value={currentReport.config.timeRange.end.toISOString().split('T')[0]}
                      onChange={(e) => setCurrentReport(prev => ({
                        ...prev,
                        config: {
                          ...prev.config,
                          timeRange: {
                            ...prev.config.timeRange,
                            end: new Date(e.target.value)
                          }
                        }
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Data Configuration Tab */}
            {activeTab === 'data' && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Metrics
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {METRICS.map((metric) => (
                      <Checkbox
                        key={metric.value}
                        checked={currentReport.config.metrics.includes(metric.value)}
                        onChange={(checked) => {
                          setCurrentReport(prev => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              metrics: checked
                                ? [...prev.config.metrics, metric.value]
                                : prev.config.metrics.filter(m => m !== metric.value)
                            }
                          }))
                        }}
                        label={metric.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dimensions
                  </label>
                  <div className="space-y-2">
                    {DIMENSIONS.map((dimension) => (
                      <Checkbox
                        key={dimension.value}
                        checked={currentReport.config.dimensions.includes(dimension.value)}
                        onChange={(checked) => {
                          setCurrentReport(prev => ({
                            ...prev,
                            config: {
                              ...prev.config,
                              dimensions: checked
                                ? [...prev.config.dimensions, dimension.value]
                                : prev.config.dimensions.filter(d => d !== dimension.value)
                            }
                          }))
                        }}
                        label={dimension.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period
                  </label>
                  <Select
                    value={currentReport.config.timeRange.period}
                    onChange={(value) => setCurrentReport(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        timeRange: {
                          ...prev.config.timeRange,
                          period: value as any
                        }
                      }
                    }))}
                    options={[
                      { value: 'day', label: 'Daily' },
                      { value: 'week', label: 'Weekly' },
                      { value: 'month', label: 'Monthly' },
                      { value: 'quarter', label: 'Quarterly' },
                      { value: 'year', label: 'Yearly' },
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Schedule & Delivery Tab */}
            {activeTab === 'schedule' && (
              <div className="p-6 space-y-6">
                {currentReport.type === 'scheduled' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <Select
                        value={currentReport.schedule?.frequency || 'weekly'}
                        onChange={(value) => setCurrentReport(prev => ({
                          ...prev,
                          schedule: {
                            ...prev.schedule,
                            frequency: value as any,
                            time: prev.schedule?.time || '09:00',
                            timezone: prev.schedule?.timezone || 'UTC',
                          }
                        }))}
                        options={FREQUENCIES}
                      />
                    </div>

                    {currentReport.schedule?.frequency === 'weekly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Day of Week
                        </label>
                        <Select
                          value={currentReport.schedule?.dayOfWeek?.toString() || '1'}
                          onChange={(value) => setCurrentReport(prev => ({
                            ...prev,
                            schedule: {
                              ...prev.schedule!,
                              dayOfWeek: parseInt(value)
                            }
                          }))}
                          options={DAYS_OF_WEEK.map(d => ({ value: d.value.toString(), label: d.label }))}
                        />
                      </div>
                    )}

                    {currentReport.schedule?.frequency === 'monthly' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Day of Month
                        </label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={currentReport.schedule?.dayOfMonth || 1}
                          onChange={(e) => setCurrentReport(prev => ({
                            ...prev,
                            schedule: {
                              ...prev.schedule!,
                              dayOfMonth: parseInt(e.target.value)
                            }
                          }))}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time
                      </label>
                      <Input
                        type="time"
                        value={currentReport.schedule?.time || '09:00'}
                        onChange={(e) => setCurrentReport(prev => ({
                          ...prev,
                          schedule: {
                            ...prev.schedule!,
                            time: e.target.value
                          }
                        }))}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipients
                  </label>
                  <div className="space-y-2">
                    {currentReport.recipients.map((email, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            const newRecipients = [...currentReport.recipients]
                            newRecipients[index] = e.target.value
                            setCurrentReport(prev => ({ ...prev, recipients: newRecipients }))
                          }}
                          placeholder="Enter email address"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newRecipients = currentReport.recipients.filter((_, i) => i !== index)
                            setCurrentReport(prev => ({ ...prev, recipients: newRecipients }))
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentReport(prev => ({
                          ...prev,
                          recipients: [...prev.recipients, '']
                        }))
                      }}
                    >
                      Add Recipient
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Format & Layout Tab */}
            {activeTab === 'format' && (
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Output Format
                  </label>
                  <Select
                    value={currentReport.format}
                    onChange={(value) => setCurrentReport(prev => ({ ...prev, format: value as any }))}
                    options={FORMATS}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Include Sections
                  </label>
                  <div className="space-y-2">
                    <Checkbox
                      checked={currentReport.config.includeExecutiveSummary}
                      onChange={(checked) => setCurrentReport(prev => ({
                        ...prev,
                        config: { ...prev.config, includeExecutiveSummary: checked }
                      }))}
                      label="Executive Summary"
                    />
                    <Checkbox
                      checked={currentReport.config.includeCharts}
                      onChange={(checked) => setCurrentReport(prev => ({
                        ...prev,
                        config: { ...prev.config, includeCharts: checked }
                      }))}
                      label="Charts and Visualizations"
                    />
                    <Checkbox
                      checked={currentReport.config.includeTables}
                      onChange={(checked) => setCurrentReport(prev => ({
                        ...prev,
                        config: { ...prev.config, includeTables: checked }
                      }))}
                      label="Data Tables"
                    />
                  </div>
                </div>
              </div>
            )}
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 p-6">
          <Card className="h-full">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Report Preview</h3>
              <div className="bg-gray-100 rounded-lg p-8 h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4">📊</div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {currentReport.name}
                  </h4>
                  <p className="text-gray-500 mb-4">
                    Click "Preview" to see how your report will look
                  </p>
                  <div className="text-sm text-gray-400">
                    Format: {currentReport.format.toUpperCase()} |
                    Metrics: {currentReport.config.metrics.length} |
                    Type: {currentReport.type}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <ReportPreviewModal
          report={currentReport}
          previewData={previewData}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

interface ReportPreviewModalProps {
  report: Report
  previewData: any
  onClose: () => void
}

function ReportPreviewModal({ report, previewData, onClose }: ReportPreviewModalProps): JSX.Element {
  return (
    <Modal isOpen onClose={onClose} title={`Preview: ${report.name}`} size="large">
      <div className="space-y-6">
        {/* Executive Summary */}
        {report.config.includeExecutiveSummary && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Executive Summary</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {previewData.summary.totalSubscribers.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Subscribers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {previewData.summary.averageOpenRate}%
                  </div>
                  <div className="text-sm text-gray-600">Open Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {previewData.summary.averageClickRate}%
                  </div>
                  <div className="text-sm text-gray-600">Click Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    ${previewData.summary.totalRevenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Revenue</div>
                </div>
              </div>
              <div className="space-y-2">
                {previewData.insights.map((insight: string, index: number) => (
                  <div key={index} className="text-sm text-gray-700">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {report.config.includeCharts && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Charts & Visualizations</h3>
            <div className="bg-gray-100 rounded-lg p-6 h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl mb-2">📈</div>
                <div className="text-gray-600">Chart visualization would appear here</div>
                <div className="text-sm text-gray-500 mt-2">
                  {previewData.charts[0]?.title} - {previewData.charts[0]?.type} chart
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Tables */}
        {report.config.includeTables && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Tables</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Open Rate
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {previewData.summary.averageOpenRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      +2.3%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Click Rate
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {previewData.summary.averageClickRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                      +0.8%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close Preview
          </Button>
          <Button>
            Generate Full Report
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ReportBuilder
