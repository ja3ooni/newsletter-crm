'use client'

import { Button } from '@/components/ui/Button'
import { newsletterApi } from '@/lib/api/newsletter'
import { useNewsletterStore } from '@/store/newsletterStore'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function NewsletterPreviewPage(): JSX.Element {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string

  const { currentNewsletter, fetchNewsletter } = useNewsletterStore()
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (newsletterId) {
      loadNewsletter()
    }
  }, [newsletterId])

  const loadNewsletter = async () => {
    setLoading(true)
    setError(null)

    try {
      await fetchNewsletter(newsletterId)
      const preview = await newsletterApi.previewNewsletter(newsletterId)
      setPreviewHtml(preview.html)
    } catch (err) {
      setError('Failed to load newsletter preview')
      console.error('Preview error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading preview...</p>
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">Preview Error</h3>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push(`/dashboard/newsletters/${newsletterId}/builder`)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {currentNewsletter?.title || 'Newsletter Preview'}
              </h1>
              <p className="text-sm text-gray-500">Preview Mode</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/newsletters/${newsletterId}/builder`)}
            >
              Edit
            </Button>
            <Button
              onClick={() => router.push(`/dashboard/newsletters/${newsletterId}/analytics`)}
            >
              View Analytics
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
          {previewHtml ? (
            <iframe
              srcDoc={previewHtml}
              className="w-full min-h-[800px] border-0"
              title="Newsletter Preview"
            />
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500">No preview available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
