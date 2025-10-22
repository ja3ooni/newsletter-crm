'use client'

import { Card } from '@/components/ui/Card';

interface ChartWidgetProps {
  title: string
  data: Array<{ name: string; value: number }>
  className?: string
}

export function ChartWidget({ title, data, className = '' }: ChartWidgetProps): JSX.Element {
  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="flex items-center">
            <div className="w-20 text-sm text-gray-600 truncate">{item.name}</div>
            <div className="flex-1 mx-3">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-12 text-sm font-medium text-gray-900 text-right">
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default ChartWidget
