'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { segmentsApi } from '@/lib/api/crm'
import type { Segment, SegmentCondition } from '@/types/crm'
import React, { useState } from 'react'

interface SegmentBuilderProps {
  segment?: Segment
  onSave: (segment: Segment) => void
  onCancel: () => void
}

export const SegmentBuilder: React.FC<SegmentBuilderProps> = ({
  segment,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState(segment?.name || '')
  const [description, setDescription] = useState(segment?.description || '')
  const [conditions, setConditions] = useState<SegmentCondition[]>(
    segment?.conditions || [{ field: '', operator: 'equals', value: '' }]
  )
  const [isAutoUpdating, setIsAutoUpdating] = useState(segment?.isAutoUpdating ?? true)
  const [isLoading, setIsLoading] = useState(false)

  const fieldOptions = [
    { value: 'email', label: 'Email' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'company', label: 'Company' },
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'phone', label: 'Phone' },
    { value: 'lifecycle', label: 'Lifecycle Stage' },
    { value: 'leadScore', label: 'Lead Score' },
    { value: 'source', label: 'Source' },
    { value: 'tags', label: 'Tags' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Updated Date' }
  ]

  const operatorOptions = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'in', label: 'In List' },
    { value: 'not_in', label: 'Not In List' }
  ]

  const logicalOperatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ]

  const lifecycleOptions = ['subscriber', 'lead', 'customer', 'evangelist']
  const sourceOptions = ['website', 'newsletter', 'social_media', 'referral', 'import', 'api']

  const addCondition = () => {
    setConditions([...conditions, { field: '', operator: 'equals', value: '' }])
  }

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index))
    }
  }

  const updateCondition = (index: number, updates: Partial<SegmentCondition>) => {
    setConditions(conditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    ))
  }

  const getValueInput = (condition: SegmentCondition, index: number) => {
    switch (condition.field) {
      case 'lifecycle':
        return (
          <Select
            options={[
              { value: '', label: 'Select lifecycle' },
              ...lifecycleOptions.map(option => ({ value: option, label: option }))
            ]}
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />
        )
      case 'source':
        return (
          <Select
            options={[
              { value: '', label: 'Select source' },
              ...sourceOptions.map(option => ({ value: option, label: option }))
            ]}
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />
        )
      case 'leadScore':
        return (
          <Input
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: parseInt(e.target.value) || 0 })}
            placeholder="Enter score"
          />
        )
      case 'createdAt':
      case 'updatedAt':
        return (
          <Input
            type="date"
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
          />
        )
      case 'tags':
        if (condition.operator === 'in' || condition.operator === 'not_in') {
          return (
            <div>
              <Input
                value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value}
                onChange={(e) => updateCondition(index, {
                  value: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                })}
                placeholder="Enter tags separated by commas"
              />
            </div>
          )
        }
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            placeholder="Enter tag"
          />
        )
      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            placeholder="Enter value"
          />
        )
    }
  }

  const getAvailableOperators = (field: string) => {
    switch (field) {
      case 'leadScore':
      case 'createdAt':
      case 'updatedAt':
        return operatorOptions.filter(op =>
          ['equals', 'greater_than', 'less_than'].includes(op.value)
        )
      case 'tags':
        return operatorOptions.filter(op =>
          ['contains', 'in', 'not_in'].includes(op.value)
        )
      case 'lifecycle':
      case 'source':
        return operatorOptions.filter(op =>
          ['equals', 'in', 'not_in'].includes(op.value)
        )
      default:
        return operatorOptions.filter(op =>
          ['equals', 'contains'].includes(op.value)
        )
    }
  }

  const handleSave = async () => {
    try {
      setIsLoading(true)

      const validConditions = conditions.filter(condition =>
        condition.field && condition.operator && condition.value !== ''
      )

      if (!name.trim() || validConditions.length === 0) {
        alert('Please provide a name and at least one valid condition')
        return
      }

      const segmentData = {
        name: name.trim(),
        description: description.trim(),
        conditions: validConditions,
        isAutoUpdating
      }

      let response
      if (segment) {
        response = await segmentsApi.updateSegment(segment.id, segmentData)
      } else {
        response = await segmentsApi.createSegment(segmentData)
      }

      onSave(response.data)
    } catch (err) {
      console.error('Error saving segment:', err)
      alert('Failed to save segment')
    } finally {
      setIsLoading(false)
    }
  }

  const isValid = name.trim() && conditions.some(c => c.field && c.operator && c.value !== '')

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <Input
          label="Segment Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter segment name"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter segment description"
          />
        </div>

        <Checkbox
          label="Auto-updating segment"
          description="Automatically update contact list when conditions change"
          checked={isAutoUpdating}
          onChange={(e) => setIsAutoUpdating(e.target.checked)}
        />
      </div>

      {/* Conditions Builder */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Conditions
          </h3>
          <Button variant="outline" onClick={addCondition}>
            Add Condition
          </Button>
        </div>

        <div className="space-y-4">
          {conditions.map((condition, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">
                    Rule {index + 1}
                  </Badge>
                  {index > 0 && (
                    <Select
                      options={logicalOperatorOptions}
                      value={condition.logicalOperator || 'AND'}
                      onChange={(e) => updateCondition(index, {
                        logicalOperator: e.target.value as 'AND' | 'OR'
                      })}
                    />
                  )}
                </div>
                {conditions.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCondition(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Field"
                  options={[
                    { value: '', label: 'Select field' },
                    ...fieldOptions
                  ]}
                  value={condition.field}
                  onChange={(e) => updateCondition(index, {
                    field: e.target.value,
                    operator: 'equals',
                    value: ''
                  })}
                />

                <Select
                  label="Operator"
                  options={[
                    { value: '', label: 'Select operator' },
                    ...getAvailableOperators(condition.field)
                  ]}
                  value={condition.operator}
                  onChange={(e) => updateCondition(index, {
                    operator: e.target.value as any,
                    value: ''
                  })}
                  disabled={!condition.field}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value
                  </label>
                  {condition.field && condition.operator ? (
                    getValueInput(condition, index)
                  ) : (
                    <Input
                      disabled
                      placeholder="Select field and operator first"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Preview
        </h3>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            This segment will include contacts where:
          </div>
          <div className="mt-2 space-y-1">
            {conditions.map((condition, index) => {
              if (!condition.field || !condition.operator || condition.value === '') {
                return null
              }

              return (
                <div key={index} className="text-sm text-gray-900 dark:text-white">
                  {index > 0 && (
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {condition.logicalOperator || 'AND'}{' '}
                    </span>
                  )}
                  <span className="font-medium">{condition.field}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{condition.operator}</span>{' '}
                  <span className="font-medium">
                    {Array.isArray(condition.value)
                      ? condition.value.join(', ')
                      : String(condition.value)
                    }
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid || isLoading}>
          {isLoading ? 'Saving...' : segment ? 'Update Segment' : 'Create Segment'}
        </Button>
      </div>
    </div>
  )
}
