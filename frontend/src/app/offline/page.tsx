'use client'

import { motion } from 'framer-motion'
import { Home, Mail, Phone, RefreshCw, WifiOff } from 'lucide-react'

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoHome = () => {
    window.location.href = '/crm'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center"
      >
        {/* Offline Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <WifiOff className="h-10 w-10 text-red-600" />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold text-gray-900 mb-4"
        >
          You're Offline
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-gray-600 mb-8"
        >
          It looks like you've lost your internet connection. Don't worry, you can still access some features while offline.
        </motion.p>

        {/* Available Offline Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-blue-50 rounded-lg p-4 mb-8"
        >
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Available Offline:</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              View cached contacts and deals
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              Make phone calls and send emails
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              Create and edit tasks (will sync later)
            </li>
            <li className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
              View notification history
            </li>
          </ul>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <button
            onClick={handleRetry}
            className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </button>

          <button
            onClick={handleGoHome}
            className="w-full flex items-center justify-center py-3 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to CRM Dashboard
          </button>
        </motion.div>

        {/* Emergency Contacts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 pt-6 border-t border-gray-200"
        >
          <h4 className="text-sm font-medium text-gray-900 mb-3">Need Help?</h4>
          <div className="flex justify-center space-x-4">
            <a
              href="tel:+1-555-0123"
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <Phone className="h-4 w-4 mr-1" />
              Call Support
            </a>
            <a
              href="mailto:support@datatechtoncrm.com"
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <Mail className="h-4 w-4 mr-1" />
              Email Support
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
