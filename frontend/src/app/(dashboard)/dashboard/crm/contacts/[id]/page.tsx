'use client'

import { ContactEngagement } from '@/components/crm/ContactEngagement'
import { ContactOpportunities } from '@/components/crm/ContactOpportunities'
import { ContactProfile } from '@/components/crm/ContactProfile'
import { ContactTimeline } from '@/components/crm/ContactTimeline'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { activitiesApi, contactsApi } from '@/lib/api/crm'
import type { Activity, Contact } from '@/types/crm'
import { useParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

const ContactDetailPage: React.FC = () => {
  const params = useParams()
  const contactId = params.id as string

  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (contactId) {
      loadContactData()
    }
  }, [contactId])

  const loadContactData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [contactResponse, activitiesResponse] = await Promise.all([
        contactsApi.getContact(contactId),
        activitiesApi.getActivities({ contactId })
      ])

      setContact(contactResponse.data)
      setActivities(activitiesResponse.data)
    } catch (err) {
      setError('Failed to load contact data')
      console.error('Error loading contact:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleContactUpdate = (updatedContact: Contact) => {
    setContact(updatedContact)
  }

  const handleActivityAdd = (newActivity: Activity) => {
    setActivities([newActivity, ...activities])
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <Card>
        <div className="p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20">
            <svg
              className="h-6 w-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Contact not found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {error || 'The contact you are looking for does not exist.'}
          </p>
          <div className="mt-6">
            <Button href="/dashboard/crm">
              Back to CRM
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ContactProfile
              contact={contact}
              onUpdate={handleContactUpdate}
            />
          </div>
          <div>
            <ContactEngagement
              contact={contact}
              activities={activities}
            />
          </div>
        </div>
      )
    },
    {
      id: 'timeline',
      label: 'Timeline',
      content: (
        <ContactTimeline
          contact={contact}
          activities={activities}
          onActivityAdd={handleActivityAdd}
        />
      )
    },
    {
      id: 'opportunities',
      label: 'Opportunities',
      content: (
        <ContactOpportunities
          contactId={contact.id}
        />
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            href="/dashboard/crm"
          >
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {contact.firstName && contact.lastName
                ? `${contact.firstName} ${contact.lastName}`
                : contact.email}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {contact.company && contact.jobTitle
                ? `${contact.jobTitle} at ${contact.company}`
                : contact.company || contact.jobTitle || 'Contact Details'}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={loadContactData}
          >
            Refresh
          </Button>
          <Button
            href={`/dashboard/crm/contacts/${contact.id}/edit`}
          >
            Edit Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="overview" />
    </div>
  )
}

export default ContactDetailPage
