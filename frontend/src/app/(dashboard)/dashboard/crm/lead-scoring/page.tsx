'use client'

import { LeadScoringDashboard } from '@/components/crm/LeadScoringDashboard'
import { LeadScoringRules } from '@/components/crm/LeadScoringRules'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { leadScoringApi } from '@/lib/api/crm'
import { useCrmStore } from '@/store/crmStore'
import React, { useEffect, useState } from 'react'

const LeadScoringPage: React.FC = () => {
  const {
    leadScoringRules,
    isLoading,
    error,
    setLeadScoringRules,
    setLoading,
    setError,
    clearError
  } = useCrmStore()

  const [isRecalculating, setIsRecalculating] = useState(false)

  useEffect(() => {
    loadLeadScoringRules()
  }, [])

  const loadLeadScoringRules = async () => {
    try {
      setLoading(true)
      clearError()
      const response = await leadScoringApi.getRules()
      setLeadScoringRules(response.data)
    } catch (err) {
      setError('Failed to load lead scoring rules')
      console.error('Error loading lead scoring rules:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculateScores = async () => {
    try {
      setIsRecalculating(true)
      await leadScoringApi.recalculateScores()
      // You might want to show a success message or refresh data
      alert('Lead scores recalculation started. This may take a few minutes.')
    } catch (err) {
      console.error('Error recalculating scores:', err)
      alert('Failed to start score recalculation')
    } finally {
      setIsRecalculating(false)
    }
  }

  const handleRefresh = () => {
    loadLeadScoringRules()
  }

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      content: <LeadScoringDashboard />
    },
    {
      id: 'rules',
      label: 'Scoring Rules',
      content: (
        <LeadScoringRules
          rules={leadScoringRules}
          isLoading={isLoading}
          onRefresh={handleRefresh}
        />
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lead Scoring
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage lead scoring rules and track contact engagement
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleRecalculateScores}
            disabled={isRecalculating}
          >
            {isRecalculating ? 'Recalculating...' : 'Recalculate All Scores'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={clearError}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="dashboard" />
    </div>
  )
}

export default LeadScoringPage
