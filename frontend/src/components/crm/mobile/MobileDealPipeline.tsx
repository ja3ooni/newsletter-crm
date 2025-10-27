'use client'

import { Deal } from '@/types/crm'
import { motion } from 'framer-motion'
import {
    AlertTriangle,
    Building,
    Calendar,
    ChevronRight,
    Clock,
    DollarSign,
    Percent,
    Target,
    TrendingUp,
    User
} from 'lucide-react'
import React from 'react'

interface MobileDealPipelineProps {
  deals: Deal[]
  onDealClick?: (deal: Deal) => void
  className?: string
}

export const MobileDealPipeline: React.FC<MobileDealPipelineProps> = ({
  deals,
  onDealClick,
  className = ''
}) => {
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500 bg-red-50'
      case 'high':
        return 'border-orange-500 bg-orange-50'
      case 'medium':
        return 'border-yellow-500 bg-yellow-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
        return 'text-green-600 bg-green-100'
      case 'lost':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-blue-600 bg-blue-100'
    }
  }

  const getProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-600'
    if (probability >= 60) return 'text-yellow-600'
    if (probability >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const isClosingSoon = (closeDate?: Date) => {
    if (!closeDate) return false
    const now = new Date()
    const close = new Date(closeDate)
    const diffInDays = (close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diffInDays <= 7 && diffInDays >= 0
  }

  const isOverdue = (closeDate?: Date) => {
    if (!closeDate) return false
    return new Date(closeDate) < new Date()
  }

  const formatCloseDate = (closeDate?: Date) => {
    if (!closeDate) return null

    const now = new Date()
    const close = new Date(closeDate)
    const diffInDays = Math.ceil((close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffInDays < 0) {
      return 'Overdue'
    } else if (diffInDays === 0) {
      return 'Due today'
    } else if (diffInDays === 1) {
      return 'Due tomorrow'
    } else if (diffInDays <= 7) {
      return `Due in ${diffInDays} days`
    } else {
      return close.toLocaleDateString()
    }
  }

  if (deals.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No active deals</p>
        <p className="text-sm text-gray-400 mt-1">Start by creating your first deal</p>
      </div>
    )
  }

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0)
  const weightedValue = deals.reduce((sum, deal) => sum + ((deal.value || 0) * deal.probability / 100), 0)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Pipeline Summary */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Pipeline Summary</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Value</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(totalValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Weighted Value</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(weightedValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Deals List */}
      <div className="space-y-3">
        {deals.map((deal, index) => {
          const closingSoon = isClosingSoon(deal.expectedCloseDate)
          const overdue = isOverdue(deal.expectedCloseDate)
          const closeDateText = formatCloseDate(deal.expectedCloseDate)

          return (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-lg border-l-4 p-4 ${getPriorityColor(deal.priority)}`}
              onClick={() => onDealClick?.(deal)}
            >
              <div className="flex items-start space-x-3">
                {/* Deal Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg ${
                  deal.priority === 'urgent' ? 'bg-red-100' :
                  deal.priority === 'high' ? 'bg-orange-100' :
                  deal.priority === 'medium' ? 'bg-yellow-100' :
                  'bg-gray-100'
                }`}>
                  <TrendingUp className={`h-4 w-4 ${
                    deal.priority === 'urgent' ? 'text-red-600' :
                    deal.priority === 'high' ? 'text-orange-600' :
                    deal.priority === 'medium' ? 'text-yellow-600' :
                    'text-gray-600'
                  }`} />
                </div>

                {/* Deal Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {deal.name}
                      </h3>

                      {/* Deal Value */}
                      <div className="flex items-center mt-1">
                        <DollarSign className="h-3 w-3 text-green-600 mr-1" />
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(deal.value || 0, deal.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Probability */}
                    <div className="flex flex-col items-end ml-2">
                      <div className={`flex items-center ${getProbabilityColor(deal.probability)}`}>
                        <Percent className="h-3 w-3 mr-1" />
                        <span className="text-sm font-medium">{deal.probability}%</span>
                      </div>

                      {/* Status Badge */}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getStatusColor(deal.status)}`}>
                        {deal.status}
                      </span>
                    </div>
                  </div>

                  {/* Deal Meta Information */}
                  <div className="mt-3 space-y-2">
                    {/* Close Date */}
                    {deal.expectedCloseDate && (
                      <div className={`flex items-center text-xs ${
                        overdue ? 'text-red-600' : closingSoon ? 'text-orange-600' : 'text-gray-500'
                      }`}>
                        {overdue ? (
                          <AlertTriangle className="h-3 w-3 mr-1" />
                        ) : closingSoon ? (
                          <Clock className="h-3 w-3 mr-1" />
                        ) : (
                          <Calendar className="h-3 w-3 mr-1" />
                        )}
                        <span>{closeDateText}</span>
                      </div>
                    )}

                    {/* Owner */}
                    {deal.ownerId && (
                      <div className="flex items-center text-xs text-gray-500">
                        <User className="h-3 w-3 mr-1" />
                        <span>Owner: {deal.ownerId}</span>
                      </div>
                    )}

                    {/* Company */}
                    {deal.companyId && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Building className="h-3 w-3 mr-1" />
                        <span>Company: {deal.companyId}</span>
                      </div>
                    )}

                    {/* Source */}
                    {deal.source && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Target className="h-3 w-3 mr-1" />
                        <span>Source: {deal.source}</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {deal.tags && deal.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {deal.tags.slice(0, 2).map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                      {deal.tags.length > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          +{deal.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">Progress</span>
                      <span className="text-xs text-gray-500">{deal.probability}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${deal.probability}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className={`h-1.5 rounded-full ${
                          deal.probability >= 80 ? 'bg-green-500' :
                          deal.probability >= 60 ? 'bg-yellow-500' :
                          deal.probability >= 40 ? 'bg-orange-500' :
                          'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Last Activity */}
                  {deal.lastActivityAt && (
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>
                          Last activity: {new Date(deal.lastActivityAt).toLocaleDateString()}
                        </span>
                      </div>

                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
