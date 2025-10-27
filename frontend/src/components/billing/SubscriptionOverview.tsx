'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useBillingStore } from '@/store/billingStore'
import { Subscription } from '@/types/billing'
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

interface SubscriptionOverviewProps {
  subscription: Subscription
}

export default function SubscriptionOverview({
  subscription,
}: SubscriptionOverviewProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false)
  const {
    cancelSubscription,
    reactivateSubscription,
    fetchCurrentSubscription,
  } = useBillingStore()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'trialing':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'incomplete':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />
      case 'trialing':
        return <Clock className="h-4 w-4" />
      case 'past_due':
        return <AlertTriangle className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const handleCancelSubscription = async (immediately = false) => {
    setIsLoading(true)
    try {
      await cancelSubscription(subscription.id, immediately)
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setIsLoading(true)
    try {
      await reactivateSubscription(subscription.id)
    } catch (error) {
      console.error('Failed to reactivate subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncSubscription = async () => {
    setIsLoading(true)
    try {
      await fetchCurrentSubscription()
    } catch (error) {
      console.error('Failed to sync subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const daysUntilRenewal = Math.ceil(
    (new Date(subscription.currentPeriodEnd).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
  )

  const isTrialing = subscription.status === 'trialing'
  const trialDaysRemaining = subscription.trialEnd
    ? Math.ceil(
        (new Date(subscription.trialEnd).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : 0

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {subscription.status === 'past_due' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your subscription payment is past due. Please update your payment
            method to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      {subscription.cancelAtPeriodEnd && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your subscription will be cancelled at the end of the current
            billing period on {formatDate(subscription.currentPeriodEnd)}.
          </AlertDescription>
        </Alert>
      )}

      {isTrialing && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            You&apos;re currently on a free trial.{' '}
            {trialDaysRemaining > 0
              ? `${trialDaysRemaining} days remaining.`
              : 'Your trial has ended.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge className={getStatusColor(subscription.status)}>
                {getStatusIcon(subscription.status)}
                <span className="ml-1 capitalize">{subscription.status}</span>
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Plan</span>
              <span className="text-sm">
                {subscription.plan?.name || 'Unknown Plan'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Billing Interval</span>
              <span className="text-sm capitalize">
                {subscription.plan?.billingInterval || 'monthly'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Amount</span>
              <span className="text-sm font-semibold">
                {subscription.plan?.price
                  ? formatCurrency(
                      subscription.plan.price / 100,
                      subscription.plan.currency
                    )
                  : 'Free'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Subscription ID</span>
              <span className="text-muted-foreground font-mono text-xs">
                {subscription.id.slice(0, 8)}...
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Billing Cycle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Billing Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Period Start</span>
              <span className="text-sm">
                {formatDate(subscription.currentPeriodStart)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Period End</span>
              <span className="text-sm">
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Days Remaining</span>
                <span className="text-sm">
                  {Math.max(0, daysUntilRenewal)} days
                </span>
              </div>
              <Progress
                value={Math.max(
                  0,
                  Math.min(100, ((30 - daysUntilRenewal) / 30) * 100)
                )}
                className="h-2"
              />
            </div>

            {isTrialing && subscription.trialEnd && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Trial Ends</span>
                <span className="text-sm">
                  {formatDate(subscription.trialEnd)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Actions</CardTitle>
          <CardDescription>
            Manage your subscription settings and billing preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleSyncSubscription}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Status
            </Button>

            {subscription.status === 'active' &&
              !subscription.cancelAtPeriodEnd && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Cancel Subscription</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel your subscription?
                        You&apos;ll continue to have access until the end of
                        your current billing period on{' '}
                        {formatDate(subscription.currentPeriodEnd)}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancelSubscription(false)}
                        disabled={isLoading}
                      >
                        Cancel at Period End
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

            {subscription.cancelAtPeriodEnd && (
              <Button
                variant="default"
                onClick={handleReactivateSubscription}
                disabled={isLoading}
              >
                Reactivate Subscription
              </Button>
            )}

            {subscription.status === 'past_due' && (
              <Button variant="default">Update Payment Method</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
