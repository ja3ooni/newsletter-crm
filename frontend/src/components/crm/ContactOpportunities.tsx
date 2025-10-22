'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { opportunitiesApi, pipelineApi } from '@/lib/api/crm'
import type { Opportunity, SalesPipeline } from '@/types/crm'
import React, { useEffect, useState } from 'react'

interface ContactOpportunitiesProps {
  contactId: string
}

export const ContactOpportunities: React.FC<ContactOpportunitiesProps> = ({
  contactId
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [pipelines, setPipelines] = useState<SalesPipeline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newOpportunity, setNewOpportunity] = useState<Partial<Opportunity>>({
    contactId,
    name: '',
    value: 0,
    currency: 'USD',
    probability: 50,
    source: 'manual'
  })

  useEffect(() => {
    loadData()
  }, [contactId])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [opportunitiesResponse, pipelinesResponse] = await Promise.all([
        opportunitiesApi.getOpportunities({ contactId }),
        pipelineApi.getPipelines()
      ])

      setOpportunities(opportunitiesResponse.data)
      setPipelines(pipelinesResponse.data)
    } catch (err) {
      console.error('Error loading opportunities:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOpportunity = async () => {
    try {
      if (!newOpportunity.pipelineId || !newOpportunity.stageId) {
        return
      }

      const response = await opportunitiesApi.createOpportunity({
        ...newOpportunity,
        customFields: {}
      } as Omit<Opportunity, 'id' | 'activities' | 'createdAt' | 'updatedAt'>)

      setOpportunities([response.data, ...opportunities])
      setNewOpportunity({
        contactId,
        name: '',
        value: 0,
        currency: 'USD',
        probability: 50,
        source: 'manual'
      })
      setShowCreateModal(false)
    } catch (err) {
      console.error('Error creating opportunity:', err)
    }
  }

  const handleStageChange = async (opportunityId: string, stageId: string) => {
    try {
      const response = await opportunitiesApi.moveOpportunity(opportunityId, stageId)
      setOpportunities(opportunities.map(opp =>
        opp.id === opportunityId ? response.data : opp
      ))
    } catch (err) {
      console.error('Error moving opportunity:', err)
    }
  }

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStageColor = (stageId: string): 'default' | 'secondary' | 'success' | 'warning' | 'error' => {
    const pipeline = pipelines.find(p => p.stages.some(s => s.id === stageId))
    const stage = pipeline?.stages.find(s => s.id === stageId)

    if (stage?.isClosedWon) return 'success'
    if (stage?.isClosedLost) return 'error'
    if (stage && stage.probability >= 75) return 'secondary'
    if (stage && stage.probability >= 50) return 'warning'
    return 'default'
  }

  const getStageName = (stageId: string): string => {
    const pipeline = pipelines.find(p => p.stages.some(s => s.id === stageId))
    const stage = pipeline?.stages.find(s => s.id === stageId)
    return stage?.name || 'Unknown Stage'
  }

  const getPipelineOptions = () => {
    return pipelines.map(pipeline => ({
      value: pipeline.id,
      label: pipeline.name
    }))
  }

  const getStageOptions = (pipelineId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId)
    return pipeline?.stages.map(stage => ({
      value: stage.id,
      label: `${stage.name} (${stage.probability}%)`
    })) || []
  }

  const totalValue = opportunities.reduce((sum, opp) => sum + opp.value, 0)
  const weightedValue = opportunities.reduce((sum, opp) => sum + (opp.value * opp.probability / 100), 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Opportunities
          </h2>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Opportunity
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Opportunities</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {opportunities.length}
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Value</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(totalValue, 'USD')}
              </div>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">Weighted Value</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(weightedValue, 'USD')}
              </div>
            </div>
          </Card>
        </div>

        {/* Opportunities List */}
        {opportunities.length > 0 ? (
          <div className="space-y-4">
            {opportunities.map((opportunity) => (
              <Card key={opportunity.id}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {opportunity.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {opportunity.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(opportunity.value, opportunity.currency)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {opportunity.probability}% probability
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Stage
                      </label>
                      <Badge variant={getStageColor(opportunity.stageId)}>
                        {getStageName(opportunity.stageId)}
                      </Badge>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Source
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {opportunity.source}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Expected Close
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Created
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {formatDate(opportunity.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <Select
                        options={[
                          { value: '', label: 'Move to stage...' },
                          ...getStageOptions(opportunity.pipelineId)
                        ]}
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStageChange(opportunity.id, e.target.value)
                          }
                        }}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        href={`/dashboard/crm/opportunities/${opportunity.id}`}
                      >
                        View Details
                      </Button>
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
                No opportunities
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Get started by creating a new opportunity for this contact.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Create Opportunity Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Opportunity"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Opportunity Name"
            value={newOpportunity.name || ''}
            onChange={(e) => setNewOpportunity({ ...newOpportunity, name: e.target.value })}
            placeholder="Enter opportunity name"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Value"
              type="number"
              value={newOpportunity.value || ''}
              onChange={(e) => setNewOpportunity({ ...newOpportunity, value: parseFloat(e.target.value) || 0 })}
              placeholder="0"
            />
            <Input
              label="Probability (%)"
              type="number"
              min="0"
              max="100"
              value={newOpportunity.probability || ''}
              onChange={(e) => setNewOpportunity({ ...newOpportunity, probability: parseInt(e.target.value) || 0 })}
              placeholder="50"
            />
          </div>

          <Select
            label="Pipeline"
            options={[
              { value: '', label: 'Select pipeline' },
              ...getPipelineOptions()
            ]}
            value={newOpportunity.pipelineId || ''}
            onChange={(e) => setNewOpportunity({
              ...newOpportunity,
              pipelineId: e.target.value,
              stageId: '' // Reset stage when pipeline changes
            })}
          />

          {newOpportunity.pipelineId && (
            <Select
              label="Stage"
              options={[
                { value: '', label: 'Select stage' },
                ...getStageOptions(newOpportunity.pipelineId)
              ]}
              value={newOpportunity.stageId || ''}
              onChange={(e) => setNewOpportunity({ ...newOpportunity, stageId: e.target.value })}
            />
          )}

          <Input
            label="Expected Close Date"
            type="date"
            value={newOpportunity.expectedCloseDate || ''}
            onChange={(e) => setNewOpportunity({ ...newOpportunity, expectedCloseDate: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={3}
              value={newOpportunity.description || ''}
              onChange={(e) => setNewOpportunity({ ...newOpportunity, description: e.target.value })}
              placeholder="Enter opportunity description"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOpportunity}
              disabled={!newOpportunity.name || !newOpportunity.pipelineId || !newOpportunity.stageId}
            >
              Create Opportunity
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
