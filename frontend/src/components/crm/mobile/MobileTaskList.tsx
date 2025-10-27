'use client'

import { Task } from '@/types/crm'
import { motion } from 'framer-motion'
import {
    AlertTriangle,
    Building,
    CheckCircle,
    ChevronRight,
    Clock,
    FileText,
    Mail,
    MessageSquare,
    Phone,
    TrendingUp,
    User,
    Users
} from 'lucide-react'
import React from 'react'

interface MobileTaskListProps {
  tasks: Task[]
  onTaskComplete?: (taskId: string) => void
  onTaskClick?: (task: Task) => void
  className?: string
}

export const MobileTaskList: React.FC<MobileTaskListProps> = ({
  tasks,
  onTaskComplete,
  onTaskClick,
  className = ''
}) => {
  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'call':
        return Phone
      case 'email':
        return Mail
      case 'meeting':
        return Users
      case 'follow_up':
        return MessageSquare
      case 'demo':
        return TrendingUp
      case 'proposal':
        return FileText
      default:
        return CheckCircle
    }
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
      case 'completed':
        return 'text-green-600'
      case 'in_progress':
        return 'text-blue-600'
      case 'overdue':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const isOverdue = (dueDate?: Date) => {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  const formatDueDate = (dueDate?: Date) => {
    if (!dueDate) return null

    const now = new Date()
    const due = new Date(dueDate)
    const diffInHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 0) {
      return 'Overdue'
    } else if (diffInHours < 24) {
      return `Due in ${Math.ceil(diffInHours)}h`
    } else {
      const diffInDays = Math.ceil(diffInHours / 24)
      return `Due in ${diffInDays}d`
    }
  }

  if (tasks.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No urgent tasks</p>
        <p className="text-sm text-gray-400 mt-1">Great job staying on top of things!</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {tasks.map((task, index) => {
        const TaskIcon = getTaskIcon(task.type)
        const overdue = isOverdue(task.dueDate)
        const dueDateText = formatDueDate(task.dueDate)

        return (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`rounded-lg border-l-4 p-4 ${getPriorityColor(task.priority)} ${
              task.status === 'completed' ? 'opacity-60' : ''
            }`}
            onClick={() => onTaskClick?.(task)}
          >
            <div className="flex items-start space-x-3">
              {/* Task Icon */}
              <div className={`flex-shrink-0 p-2 rounded-lg ${
                task.priority === 'urgent' ? 'bg-red-100' :
                task.priority === 'high' ? 'bg-orange-100' :
                task.priority === 'medium' ? 'bg-yellow-100' :
                'bg-gray-100'
              }`}>
                <TaskIcon className={`h-4 w-4 ${
                  task.priority === 'urgent' ? 'text-red-600' :
                  task.priority === 'high' ? 'text-orange-600' :
                  task.priority === 'medium' ? 'text-yellow-600' :
                  'text-gray-600'
                }`} />
              </div>

              {/* Task Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className={`text-sm font-semibold ${
                      task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                  </div>

                  {/* Complete Button */}
                  {task.status !== 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskComplete?.(task.id)
                      }}
                      className="ml-2 p-1 rounded-full hover:bg-green-100 transition-colors"
                    >
                      <CheckCircle className="h-5 w-5 text-gray-400 hover:text-green-600" />
                    </motion.button>
                  )}
                </div>

                {/* Task Meta Information */}
                <div className="mt-3 space-y-2">
                  {/* Due Date */}
                  {task.dueDate && (
                    <div className={`flex items-center text-xs ${
                      overdue ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {overdue ? (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      ) : (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      <span>{dueDateText}</span>
                    </div>
                  )}

                  {/* Assigned To */}
                  {task.assignedTo && (
                    <div className="flex items-center text-xs text-gray-500">
                      <User className="h-3 w-3 mr-1" />
                      <span>Assigned to {task.assignedTo}</span>
                    </div>
                  )}

                  {/* Related Entity */}
                  {(task.contactId || task.companyId || task.dealId) && (
                    <div className="flex items-center text-xs text-gray-500">
                      {task.contactId && <User className="h-3 w-3 mr-1" />}
                      {task.companyId && <Building className="h-3 w-3 mr-1" />}
                      {task.dealId && <TrendingUp className="h-3 w-3 mr-1" />}
                      <span>
                        Related to {task.contactId ? 'contact' : task.companyId ? 'company' : 'deal'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {task.tags && task.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {task.tags.slice(0, 2).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                    {task.tags.length > 2 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        +{task.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Status Badge */}
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    task.status === 'overdue' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status.replace('_', ' ')}
                  </span>

                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
