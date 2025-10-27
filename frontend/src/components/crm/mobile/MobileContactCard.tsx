'use client'

import { Contact } from '@/types/crm'
import { motion } from 'framer-motion'
import {
    Building,
    Calendar,
    ChevronRight,
    Mail,
    MapPin,
    Phone,
    Star,
    Tag,
    User
} from 'lucide-react'
import React from 'react'

interface MobileContactCardProps {
  contact: Contact
  onCall?: () => void
  onEmail?: () => void
  onClick?: () => void
  className?: string
}

export const MobileContactCard: React.FC<MobileContactCardProps> = ({
  contact,
  onCall,
  onEmail,
  onClick,
  className = ''
}) => {
  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || contact.email.charAt(0).toUpperCase()
  }

  const getLifecycleColor = (lifecycle: string) => {
    switch (lifecycle) {
      case 'lead':
        return 'bg-yellow-100 text-yellow-800'
      case 'marketing_qualified_lead':
        return 'bg-orange-100 text-orange-800'
      case 'sales_qualified_lead':
        return 'bg-blue-100 text-blue-800'
      case 'opportunity':
        return 'bg-purple-100 text-purple-800'
      case 'customer':
        return 'bg-green-100 text-green-800'
      case 'evangelist':
        return 'bg-pink-100 text-pink-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {getInitials(contact.firstName, contact.lastName)}
          </div>
        </div>

        {/* Contact Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {contact.firstName && contact.lastName
                  ? `${contact.firstName} ${contact.lastName}`
                  : contact.email}
              </h3>

              {contact.jobTitle && (
                <p className="text-sm text-gray-600 truncate mt-0.5">
                  {contact.jobTitle}
                </p>
              )}

              {contact.company && (
                <div className="flex items-center mt-1">
                  <Building className="h-3 w-3 text-gray-400 mr-1" />
                  <p className="text-sm text-gray-600 truncate">{contact.company}</p>
                </div>
              )}
            </div>

            {/* Lead Score */}
            <div className="flex flex-col items-end ml-2">
              <div className={`flex items-center ${getScoreColor(contact.leadScore)}`}>
                <Star className="h-3 w-3 mr-1" />
                <span className="text-sm font-medium">{contact.leadScore}</span>
              </div>

              {/* Lifecycle Badge */}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getLifecycleColor(contact.lifecycle)}`}>
                {contact.lifecycle.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="h-3 w-3 text-gray-400 mr-2" />
              <span className="truncate">{contact.email}</span>
            </div>

            {contact.phone && (
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="h-3 w-3 text-gray-400 mr-2" />
                <span>{contact.phone}</span>
              </div>
            )}

            {contact.address?.city && (
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-3 w-3 text-gray-400 mr-2" />
                <span className="truncate">
                  {contact.address.city}
                  {contact.address.state && `, ${contact.address.state}`}
                </span>
              </div>
            )}
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {contact.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                >
                  <Tag className="h-2 w-2 mr-1" />
                  {tag}
                </span>
              ))}
              {contact.tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  +{contact.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Last Activity */}
          {contact.lastActivityAt && (
            <div className="mt-2 flex items-center text-xs text-gray-500">
              <Calendar className="h-3 w-3 mr-1" />
              <span>
                Last activity: {new Date(contact.lastActivityAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Action Arrow */}
        <div className="flex-shrink-0">
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 flex space-x-2">
        {contact.phone && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation()
              onCall?.()
            }}
            className="flex-1 flex items-center justify-center py-2 px-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            <Phone className="h-4 w-4 mr-1" />
            <span className="text-sm font-medium">Call</span>
          </motion.button>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation()
            onEmail?.()
          }}
          className="flex-1 flex items-center justify-center py-2 px-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Mail className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">Email</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation()
            // Navigate to contact profile
          }}
          className="flex items-center justify-center py-2 px-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <User className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  )
}
