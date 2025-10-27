'use client'

import BillingAnalytics from '@/components/billing/BillingAnalytics'
import BillingHistory from '@/components/billing/BillingHistory'
import PlanUpgrade from '@/components/billing/PlanUpgrade'
import PromoCodeManager from '@/components/billing/PromoCodeManager'
import SubscriptionOverview from '@/components/billing/SubscriptionOverview'
import UsageTracking from '@/components/billing/UsageTracking'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { useBillingStore } from '@/store/billingStore'
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Settings
} from 'lucide-react'
import { useEffect } from 'react'

export default function BillingPage(): JSX.Element {
  const {
    currentSubscription,
    subscriptionPlans,
    invoices,
    usageTracking,
    billingAnalytics,
    isLoadingSubscription,
    isLoadingPlans,
    isLoadingInvoices,
    isLoadingAnalytics,
    subscriptionError,
    invoiceError,
    error,
    fetchCurrentSubscription,
    fetchSubscriptionPlans,
    fetchInvoices,
    fetchBillingAnalytics,
    fetchUsageTracking,
    clearError,
  } = useBillingStore()

  useEffect(() => {
    const loadBillingData = async () => {
      await Promise.all([
        fetchCurrentSubscription(),
        fetchSubscriptionPlans(),
        fetchInvoices(),
        fetchBillingAnalytics(),
      ])

      // Load usage tracking if we have an active subscription
      if (currentSubscription?.id) {
        await fetchUsageTracking(currentSubscription.id)
      }
    }

    loadBillingData()
  }, [])

  useEffect(() => {
    if (currentSubscription?.id && !usageTracking.length) {
      fetchUsageTracking(currentSubscription.id)
    }
  }, [currentSubscription?.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'trialing':
        return 'bg-blue-100 text-blue-800'
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" aria-hidden="true" />
      case 'trialing':
        return <Clock className="h-4 w-4" aria-hidden="true" />
      case 'past_due':
        return <AlertCircle className="h-4 w-4" aria-hidden="true" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4" aria-hidden="true" />
      default:
        return <Clock className="h-4 w-4" aria-hidden="true" />
    }
  }

  if (subscriptionError || invoiceError || error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive" role="alert" aria-live="assertive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <span className="sr-only">Error: </span>
            {subscriptionError || invoiceError || error}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={clearError}
              aria-label="Retry loading billing data"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription, view usage, and billing history
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Billing actions">
          <Button variant="outline" size="sm" aria-label="Export billing data to file">
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Export Data
          </Button>
          <Button variant="outline" size="sm" aria-label="Open billing settings">
            <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
            Settings
          </Button>
        </div>
      </header>

      {/* Current Subscription Overview */}
      <section aria-labelledby="subscription-overview-title">
        <Card>
        <CardHeader>
          <CardTitle id="subscription-overview-title" className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
            Current Subscription
          </CardTitle>
          <CardDescription>
            Your current plan and subscription details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSubscription ? (
            <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading subscription information">
              <Skeleton className="h-4 w-1/3" aria-label="Loading subscription plan name" />
              <Skeleton className="h-4 w-1/2" aria-label="Loading subscription details" />
              <Skeleton className="h-4 w-1/4" aria-label="Loading subscription status" />
              <span className="sr-only">Loading subscription information...</span>
            </div>
          ) : currentSubscription ? (
            <SubscriptionOverview subscription={currentSubscription} />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active subscription found</p>
              <Button aria-label="Navigate to plan selection to choose a subscription plan">Choose a Plan</Button>
            </div>
          )}
        </CardContent>
      </Card>
      </section>

      {/* Main Content Tabs */}
      <main aria-label="Billing information sections">
      <Tabs
        tabs={[
          {
            id: 'overview',
            label: 'Overview',
            content: (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  {/* Quick Stats */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                      <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {currentSubscription?.plan?.name || 'Free'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentSubscription?.plan?.type || 'freemium'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Status</CardTitle>
                      {currentSubscription && getStatusIcon(currentSubscription.status)}
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        <Badge className={getStatusColor(currentSubscription?.status || 'inactive')}>
                          {currentSubscription?.status || 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentSubscription?.cancelAtPeriodEnd ? 'Cancels at period end' : 'Active subscription'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Next Billing</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {currentSubscription?.currentPeriodEnd
                          ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentSubscription?.currentPeriodEnd
                          ? `${Math.ceil((new Date(currentSubscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining`
                          : 'No active subscription'
                        }
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ${currentSubscription?.plan?.price ? (currentSubscription.plan.price / 100).toFixed(2) : '0.00'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentSubscription?.plan?.billingInterval || 'monthly'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Usage Overview */}
                {currentSubscription && (
                  <UsageTracking
                    subscriptionId={currentSubscription.id}
                    usageData={usageTracking}
                    isLoading={false}
                  />
                )}
              </div>
            )
          },
          {
            id: 'plans',
            label: 'Plans',
            content: (
              <PlanUpgrade
                currentSubscription={currentSubscription}
                plans={subscriptionPlans}
                isLoading={isLoadingPlans}
              />
            )
          },
          {
            id: 'usage',
            label: 'Usage',
            content: currentSubscription ? (
              <UsageTracking
                subscriptionId={currentSubscription.id}
                usageData={usageTracking}
                isLoading={false}
                detailed={true}
              />
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground">No active subscription to track usage</p>
                </CardContent>
              </Card>
            )
          },
          {
            id: 'history',
            label: 'History',
            content: (
              <BillingHistory
                invoices={invoices}
                isLoading={isLoadingInvoices}
              />
            )
          },
          {
            id: 'analytics',
            label: 'Analytics',
            content: (
              <div className="space-y-6">
                <BillingAnalytics
                  analytics={billingAnalytics}
                  isLoading={isLoadingAnalytics}
                />
                <PromoCodeManager />
              </div>
            )
          }
        ]}
        defaultTab="overview"
        className="space-y-6"
      />
      </main>
    </div>
  )
}
