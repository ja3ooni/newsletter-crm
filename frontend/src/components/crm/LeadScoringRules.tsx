'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { leadScoringApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import type { LeadScoringRule, ScoringTrigger } from '@/types/crm'
import React, { useState } from 'react'

interface LeadScoringRulesProps {
  rules: LeadScoringRule[]
  isLoading: boolean
  onRefresh: () => void
}

export const LeadScoringRules: React.FC<LeadScoringRulesProps> = ({
  rules,
  isLoading,
  onRefresh
}) => {
  const { addLeadScoringRule, updateLeadScoringRule, removeLeadScoringRule } = useCrmStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState<LeadScoringRule | null>(null)
  const [newRule, setNewRule] = useState<Partial<LeadScoringRule>>({
    name: '',
    trigger: {
      type: 'email_open',
      conditions: {}
    },
    points: 10,
    isActive: true
  })

  const triggerTypeOptions = [
    { value: 'email_open', label: 'Email Open' },
    { value: 'email_click', label: 'Email Click' },
    { value: 'website_visit', label: 'Website Visit' },
    { value: 'form_submit', label: 'Form Submit' },
    { value: 'tag_added', label: 'Tag Added' }
  ]

  const handleCreateRule = async () => {
    try {
      if (!newRule.name || !newRule.trigger || newRule.points === undefined) {
        return
      }

      const response = await leadScoringApi.createRule({
        name: newRule.name,
        trigger: newRule.trigger,
        points: newRule.points,
        isActive: newRule.isActive ?? true
      })

      addLeadScoringRule(response.data)
      setNewRule({
        name: '',
        trigger: {
          type: 'email_open',
          conditions: {}
        },
        points: 10,
        isActive: true
      })
      setShowCreateModal(false)
    } catch (err) {
      console.error('Error creating rule:', err)
    }
  }

  const handleUpdateRule = async () => {
    try {
      if (!editingRule || !editingRule.name || !editingRule.trigger || editingRule.points === undefined) {
        return
      }

      const response = await leadScoringApi.updateRule(editingRule.id, {
        name: editingRule.name,
        trigger: editingRule.trigger,
        points: editingRule.points,
        isActive: editingRule.isActive
      })

      updateLeadScoringRule(editingRule.id, response.data)
      setEditingRule(null)
    } catch (err) {
      console.error('Error updating rule:', err)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Are you sure you want to delete this scoring rule?')) {
      try {
        await leadScoringApi.deleteRule(ruleId)
        removeLeadScoringRule(ruleId)
      } catch (err) {
        console.error('Error deleting rule:', err)
      }
    }
  }

  const handleToggleRule = async (rule: LeadScoringRule) => {
    try {
      const response = await leadScoringApi.updateRule(rule.id, {
        isActive: !rule.isActive
      })
      updateLeadScoringRule(rule.id, response.data)
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  const getTriggerDescription = (trigger: ScoringTrigger): string => {
    const baseDescription = triggerTypeOptions.find(opt => opt.value === trigger.type)?.label || trigger.type

    if (Object.keys(trigger.conditions).length > 0) {
      const conditions = Object.entries(trigger.conditions)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
      return `${baseDescription} (${conditions})`
    }

    return baseDescription
  }

  const renderRuleForm = (rule: Partial<LeadScoringRule>, onChange: (updates: Partial<LeadScoringRule>) => void) => (
    <div className="space-y-4">
      <Input
        label="Rule Name"
        value={rule.name || ''}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Enter rule name"
      />

      <Select
        label="Trigger Type"
        options={triggerTypeOptions}
        value={rule.trigger?.type || ''}
        onChange={(e) => onChange({
          trigger: {
            type: e.target.value as any,
            conditions: {}
          }
        })}
      />

      <Input
        label="Points"
        type="number"
        value={rule.points || ''}
        onChange={(e) => onChange({ points: parseInt(e.target.value) || 0 })}
        placeholder="Enter points to award"
      />

      {/* Trigger Conditions */}
      {rule.trigger?.type === 'tag_added' && (
        <Input
          label="Tag Name"
          value={rule.trigger.conditions.tag || ''}
          onChange={(e) => onChange({
            trigger: {
              ...rule.trigger,
              conditions: { tag: e.target.value }
            }
          })}
          placeholder="Enter tag name"
        />
      )}

      {rule.trigger?.type === 'website_visit' && (
        <Input
          label="Page URL (optional)"
          value={rule.trigger.conditions.url || ''}
          onChange={(e) => onChange({
            trigger: {
              ...rule.trigger,
              conditions: { url: e.target.value }
            }
          })}
          placeholder="Enter specific page URL or leave blank for any page"
        />
      )}

      {rule.trigger?.type === 'form_submit' && (
        <Input
          label="Form ID (optional)"
          value={rule.trigger.conditions.formId || ''}
          onChange={(e) => onChange({
            trigger: {
              ...rule.trigger,
              conditions: { formId: e.target.value }
            }
          })}
          placeholder="Enter form ID or leave blank for any form"
        />
      )}

      <Checkbox
        label="Active"
        description="Enable this scoring rule"
        checked={rule.isActive ?? true}
        onChange={(e) => onChange({ isActive: e.target.checked })}
      />
    </div>
  )

  if (isLoading) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading scoring rules...</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Scoring Rules
          </h2>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Rule
          </Button>
        </div>

        {rules.length > 0 ? (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {rule.name}
                      </h3>
                      <Badge variant={rule.isActive ? 'success' : 'default'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleRule(rule)}
                      >
                        {rule.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRule(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Trigger
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {getTriggerDescription(rule.trigger)}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Points
                      </label>
                      <div className="flex items-center space-x-2">
                        <span className={`text-lg font-semibold ${
                          rule.points > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {rule.points > 0 ? '+' : ''}{rule.points}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          points
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Status
                      </label>
                      <Badge variant={rule.isActive ? 'success' : 'default'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No scoring rules
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating your first lead scoring rule.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Create Rule Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Scoring Rule"
        size="md"
      >
        {renderRuleForm(newRule, setNewRule)}
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setShowCreateModal(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateRule}
            disabled={!newRule.name || !newRule.trigger || newRule.points === undefined}
          >
            Create Rule
          </Button>
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        title="Edit Scoring Rule"
        size="md"
      >
        {editingRule && renderRuleForm(editingRule, setEditingRule)}
        <div className="flex justify-end space-x-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setEditingRule(null)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateRule}
            disabled={!editingRule?.name || !editingRule?.trigger || editingRule?.points === undefined}
          >
            Update Rule
          </Button>
        </div>
      </Modal>
    </>
  )
}
