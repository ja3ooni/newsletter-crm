'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useNewsletterStore } from '@/store/newsletterStore'
import type { Newsletter } from '@/types/newsletter'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function NewslettersPage(): JSX.Element {
  const router = useRouter()
  const {
    newsletters,
    loading,
    error,
    fetchNewsletters,
    createNewsletter,
    deleteNewsletter,
    duplicateNewsletter
  } = useNewsletterStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Newsletter['status'] | 'all'>('all')

  useEffect(() => {
    fetchNewsletters()
  }, [fetchNewsletters])

  const filteredNewsletters = newsletters.filter(newsletter => {
    const matchesSearch = newsletter.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || newsletter.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreateNewsletter = async () => {
    try {
      const newsletter = await createNewsletter({
        title: 'Untitled Newsletter',
        sections: [],
        segments: []
      })
      router.push(`/dashboard/newsletters/${newsletter.id}/builder`)
    } catch (error) {
      console.error('Failed to create newsletter:', error)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      const duplicated = await duplicateNewsletter(id)
      router.push(`/dashboard/newsletters/${duplicated.id}/builder`)
    } catch (error) {
      console.error('Failed to duplicate newsletter:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this newsletter?')) {
      try {
        await deleteNewsletter(id)
      } catch (error) {
        console.error('Failed to delete newsletter:', error)
      }
    }
  }

  const getStatusColor = (status: Newsletter['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800'
      case 'sent':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  if (loading && newsletters.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletters</h1>
          <p className="text-gray-600">Create and manage your newsletter campaigns</p>
        </div>
        <Button onClick={handleCreateNewsletter} disabled={loading}>
          Create Newsletter
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search newsletters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Newsletter['status'] | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Newsletter grid */}
      {filteredNewsletters.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No newsletters</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all'
              ? 'No newsletters match your search criteria.'
              : 'Get started by creating your first newsletter.'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <div className="mt-6">
              <Button onClick={handleCreateNewsletter}>Create Newsletter</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNewsletters.map((newsletter) => (
            <Card key={newsletter.id} className="hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {newsletter.title}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(newsletter.status)}`}>
                    {newsletter.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDate(newsletter.createdAt)}</span>
                  </div>
                  {newsletter.scheduledAt && (
                    <div className="flex justify-between">
                      <span>Scheduled:</span>
                      <span>{formatDate(newsletter.scheduledAt)}</span>
                    </div>
                  )}
                  {newsletter.sentAt && (
                    <div className="flex justify-between">
                      <span>Sent:</span>
                      <span>{formatDate(newsletter.sentAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Sections:</span>
                    <span>{newsletter.content.sections.length}</span>
                  </div>
                </div>

                {/* Metrics for sent newsletters */}
                {newsletter.status === 'sent' && newsletter.metrics && (
                  <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {newsletter.metrics.openRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Open Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {newsletter.metrics.clickRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Click Rate</div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2">
                  <Link
                    href={`/dashboard/newsletters/${newsletter.id}/builder`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full text-sm">
                      {newsletter.status === 'draft' ? 'Edit' : 'View'}
                    </Button>
                  </Link>

                  <div className="relative">
                    <button
                      className="p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      onClick={(e) => {
                        e.preventDefault()
                        // Toggle dropdown menu
                        const menu = e.currentTarget.nextElementSibling as HTMLElement
                        menu.classList.toggle('hidden')
                      }}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>

                    <div className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
                      <div className="py-1">
                        <button
                          onClick={() => handleDuplicate(newsletter.id)}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Duplicate
                        </button>
                        <Link
                          href={`/dashboard/newsletters/${newsletter.id}/analytics`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          View Analytics
                        </Link>
                        {newsletter.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(newsletter.id)}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
