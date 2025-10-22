'use client'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { useCallback, useRef, useState } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { toast } from 'react-hot-toast'

interface Widget {
  id: string
  type: 'metric' | 'chart' | 'table' | 'heatmap' | 'funnel' | 'cohort'
  title: string
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  config: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter'
    metrics: string[]
    timeRange: {
      start: Date
      end: Date
      period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'
    }
  }
}

interface Dashboard {
  id: string
  name: string
  description?: string
  widgets: Widget[]
  layout: {
    columns: number
    rows: number
    gap: number
    responsive: boolean
  }
}

interface DashboardBuilderProps {
  dashboard?: Dashboard
  onSave: (dashboard: Dashboard) => void
  onCancel: () => void
}

const WIDGET_TYPES = [
  { value: 'metric', label: 'Metric Card', icon: '📊' },
  { value: 'chart', label: 'Chart', icon: '📈' },
  { value: 'table', label: 'Data Table', icon: '📋' },
  { value: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { value: 'funnel', label: 'Funnel', icon: '🔽' },
  { value: 'cohort', label: 'Cohort Analysis', icon: '👥' },
]

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
]

const METRICS = [
  { value: 'engagement_rate', label: 'Engagement Rate' },
  { value: 'newsletter_performance', label: 'Newsletter Performance' },
  { value: 'subscriber_growth', label: 'Subscriber Growth' },
  { value: 'revenue_attribution', label: 'Revenue Attribution' },
  { value: 'top_content', label: 'Top Content' },
  { value: 'conversion_funnel', label: 'Conversion Funnel' },
  { value: 'cohort_analysis', label: 'Cohort Analysis' },
  { value: 'kpi_summary', label: 'KPI Summary' },
  { value: 'real_time_metrics', label: 'Real-time Metrics' },
]

export function DashboardBuilder({ dashboard, onSave, onCancel }: DashboardBuilderProps): JSX.Element {
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard>(
    dashboard || {
      id: crypto.randomUUID(),
      name: 'New Dashboard',
      widgets: [],
      layout: {
        columns: 12,
        rows: 8,
        gap: 16,
        responsive: true,
      },
    }
  )
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null)
  const [showWidgetModal, setShowWidgetModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  const handleSave = useCallback(() => {
    if (!currentDashboard.name.trim()) {
      toast.error('Dashboard name is required')
      return
    }
    onSave(currentDashboard)
  }, [currentDashboard, onSave])

  const addWidget = useCallback((widgetType: string) => {
    const newWidget: Widget = {
      id: crypto.randomUUID(),
      type: widgetType as Widget['type'],
      title: `New ${widgetType} Widget`,
      position: {
        x: 0,
        y: 0,
        width: widgetType === 'metric' ? 3 : 6,
        height: widgetType === 'metric' ? 2 : 4,
      },
      config: {
        metrics: ['engagement_rate'],
        timeRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
          period: 'day',
        },
      },
    }

    setCurrentDashboard(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }))
    setSelectedWidget(newWidget)
    setShowWidgetModal(true)
  }, [])

  const updateWidget = useCallback((updatedWidget: Widget) => {
    setCurrentDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w),
    }))
  }, [])

  const removeWidget = useCallback((widgetId: string) => {
    setCurrentDashboard(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
    }))
  }, [])

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Input
                value={currentDashboard.name}
                onChange={(e) => setCurrentDashboard(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold border-none bg-transparent p-0 focus:ring-0"
                placeholder="Dashboard Name"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettingsModal(true)}
              >
                ⚙️ Settings
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Dashboard
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex">
          {/* Widget Palette */}
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Add Widgets</h3>
            <div className="space-y-2">
              {WIDGET_TYPES.map((type) => (
                <WidgetPaletteItem
                  key={type.value}
                  type={type}
                  onAdd={addWidget}
                />
              ))}
            </div>
          </div>

          {/* Dashboard Canvas */}
          <div className="flex-1 p-6">
            <DashboardCanvas
              dashboard={currentDashboard}
              onWidgetSelect={setSelectedWidget}
              onWidgetUpdate={updateWidget}
              onWidgetRemove={removeWidget}
              ref={gridRef}
            />
          </div>
        </div>

        {/* Widget Configuration Modal */}
        {showWidgetModal && selectedWidget && (
          <WidgetConfigModal
            widget={selectedWidget}
            onSave={(widget) => {
              updateWidget(widget)
              setShowWidgetModal(false)
              setSelectedWidget(null)
            }}
            onCancel={() => {
              setShowWidgetModal(false)
              setSelectedWidget(null)
            }}
          />
        )}

        {/* Dashboard Settings Modal */}
        {showSettingsModal && (
          <DashboardSettingsModal
            dashboard={currentDashboard}
            onSave={(settings) => {
              setCurrentDashboard(prev => ({ ...prev, ...settings }))
              setShowSettingsModal(false)
            }}
            onCancel={() => setShowSettingsModal(false)}
          />
        )}
      </div>
    </DndProvider>
  )
}

interface WidgetPaletteItemProps {
  type: { value: string; label: string; icon: string }
  onAdd: (type: string) => void
}

function WidgetPaletteItem({ type, onAdd }: WidgetPaletteItemProps): JSX.Element {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'widget',
    item: { widgetType: type.value },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  return (
    <div
      ref={drag}
      className={`p-3 border border-gray-200 rounded-lg cursor-move hover:bg-gray-50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onAdd(type.value)}
    >
      <div className="flex items-center space-x-3">
        <span className="text-lg">{type.icon}</span>
        <span className="text-sm font-medium text-gray-900">{type.label}</span>
      </div>
    </div>
  )
}

interface DashboardCanvasProps {
  dashboard: Dashboard
  onWidgetSelect: (widget: Widget) => void
  onWidgetUpdate: (widget: Widget) => void
  onWidgetRemove: (widgetId: string) => void
}

const DashboardCanvas = React.forwardRef<HTMLDivElement, DashboardCanvasProps>(
  ({ dashboard, onWidgetSelect, onWidgetUpdate, onWidgetRemove }, ref) => {
    const [{ isOver }, drop] = useDrop(() => ({
      accept: 'widget',
      drop: (item: { widgetType: string }, monitor) => {
        const offset = monitor.getClientOffset()
        if (offset && ref && 'current' in ref && ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const x = Math.floor((offset.x - rect.left) / (rect.width / dashboard.layout.columns))
          const y = Math.floor((offset.y - rect.top) / 100) // Approximate row height

          // This would trigger adding a widget at the dropped position
          console.log('Drop widget at', x, y)
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }))

    return (
      <div
        ref={(node) => {
          drop(node)
          if (ref && 'current' in ref) {
            ref.current = node
          }
        }}
        className={`relative bg-white rounded-lg border-2 border-dashed border-gray-300 min-h-96 ${
          isOver ? 'border-blue-400 bg-blue-50' : ''
        }`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${dashboard.layout.columns}, 1fr)`,
          gap: `${dashboard.layout.gap}px`,
          padding: `${dashboard.layout.gap}px`,
        }}
      >
        {dashboard.widgets.map((widget) => (
          <DashboardWidget
            key={widget.id}
            widget={widget}
            onSelect={() => onWidgetSelect(widget)}
            onUpdate={onWidgetUpdate}
            onRemove={() => onWidgetRemove(widget.id)}
          />
        ))}
        {dashboard.widgets.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Start Building Your Dashboard
              </h3>
              <p className="text-gray-500">
                Drag widgets from the left panel or click to add them
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }
)

DashboardCanvas.displayName = 'DashboardCanvas'

interface DashboardWidgetProps {
  widget: Widget
  onSelect: () => void
  onUpdate: (widget: Widget) => void
  onRemove: () => void
}

function DashboardWidget({ widget, onSelect, onUpdate, onRemove }: DashboardWidgetProps): JSX.Element {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'widget-move',
    item: { id: widget.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  return (
    <div
      ref={drag}
      className={`bg-white border border-gray-200 rounded-lg p-4 cursor-move hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        gridColumn: `span ${widget.position.width}`,
        gridRow: `span ${widget.position.height}`,
      }}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">{widget.title}</h4>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            ⚙️
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="text-gray-400 hover:text-red-600"
          >
            🗑️
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        Type: {widget.type} | Metrics: {widget.config.metrics.join(', ')}
      </div>
      <div className="bg-gray-100 rounded h-20 flex items-center justify-center">
        <span className="text-gray-400 text-sm">Widget Preview</span>
      </div>
    </div>
  )
}

interface WidgetConfigModalProps {
  widget: Widget
  onSave: (widget: Widget) => void
  onCancel: () => void
}

function WidgetConfigModal({ widget, onSave, onCancel }: WidgetConfigModalProps): JSX.Element {
  const [config, setConfig] = useState(widget)

  return (
    <Modal isOpen onClose={onCancel} title="Configure Widget">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Widget Title
          </label>
          <Input
            value={config.title}
            onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter widget title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Widget Type
          </label>
          <Select
            value={config.type}
            onChange={(value) => setConfig(prev => ({ ...prev, type: value as Widget['type'] }))}
            options={WIDGET_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />
        </div>

        {config.type === 'chart' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chart Type
            </label>
            <Select
              value={config.config.chartType || 'line'}
              onChange={(value) => setConfig(prev => ({
                ...prev,
                config: { ...prev.config, chartType: value as any }
              }))}
              options={CHART_TYPES}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Metrics
          </label>
          <Select
            value={config.config.metrics[0]}
            onChange={(value) => setConfig(prev => ({
              ...prev,
              config: { ...prev.config, metrics: [value] }
            }))}
            options={METRICS}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (columns)
            </label>
            <Input
              type="number"
              min="1"
              max="12"
              value={config.position.width}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                position: { ...prev.position, width: parseInt(e.target.value) }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (rows)
            </label>
            <Input
              type="number"
              min="1"
              max="8"
              value={config.position.height}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                position: { ...prev.position, height: parseInt(e.target.value) }
              }))}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(config)}>
            Save Widget
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface DashboardSettingsModalProps {
  dashboard: Dashboard
  onSave: (settings: Partial<Dashboard>) => void
  onCancel: () => void
}

function DashboardSettingsModal({ dashboard, onSave, onCancel }: DashboardSettingsModalProps): JSX.Element {
  const [settings, setSettings] = useState({
    name: dashboard.name,
    description: dashboard.description || '',
    layout: { ...dashboard.layout },
  })

  return (
    <Modal isOpen onClose={onCancel} title="Dashboard Settings">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dashboard Name
          </label>
          <Input
            value={settings.name}
            onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter dashboard name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={settings.description}
            onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter dashboard description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Columns
            </label>
            <Input
              type="number"
              min="6"
              max="24"
              value={settings.layout.columns}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                layout: { ...prev.layout, columns: parseInt(e.target.value) }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gap (px)
            </label>
            <Input
              type="number"
              min="0"
              max="50"
              value={settings.layout.gap}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                layout: { ...prev.layout, gap: parseInt(e.target.value) }
              }))}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(settings)}>
            Save Settings
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default DashboardBuilder
