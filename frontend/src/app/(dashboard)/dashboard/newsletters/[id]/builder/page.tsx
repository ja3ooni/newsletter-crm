'use client'

import { NewsletterBuilder } from '@/components/newsletter/NewsletterBuilder'
import { Button } from '@/components/ui/Button'
import { useNewsletterStore } from '@/store/newsletterStore'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function NewsletterBuilderPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string

  const {
    currentNewsletter,
    builderState,
    loading,
    error,
    fetchNewsletter,
    initializeBuilder,
    saveBuilderChanges,
    resetBuilder
  } = useNewsletterStore()

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (newsletterId) {
      fetchNewsletter(newsletterId)
    }

    return () => {
      resetBuilder()
    }
  }, [newsletterId, fetchNewsletter, resetBuilder])

  useEffect(() => {
    if (currentNewsletter && !builderState) {
      initializeBuilder(currentNewsletter)
    }
  }, [currentNewsletter, builderState, initializeBuilder])

  const handleSave = async () => {
    if (!builderState?.unsavedChanges) return

    setSaving(true)
    try {
      await saveBuilderChanges()
    } catch (error) {
      console.error('Failed to save newsletter:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (builderState?.unsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        router.push('/dashboard/newsletters')
      }
    } else {
      router.push('/dashboard/newsletters')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading newsletter builder...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-red-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading newsletter</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-6">
            <Button onClick={() => router.push('/dashboard/newsletters')}>
              Back to Newsletters
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!builderState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Initializing builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {builderState.newsletter.title}
              </h1>
              <p className="text-sm text-gray-500">
                Newsletter Builder
                {builderState.unsavedChanges && (
                  <span className="ml-2 text-orange-600">• Unsaved changes</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!builderState.unsavedChanges || saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/newsletters/${newsletterId}/preview`)}
            >
              Preview
            </Button>
          </div>
        </div>
      </div>

      {/* Builder */}
      <NewsletterBuilder />
    </div>
  )
}
