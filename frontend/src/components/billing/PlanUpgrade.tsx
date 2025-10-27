'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useBillingStore } from '@/store/billingStore'
import { Subscription, SubscriptionPlan } from '@/types/billing'
import {
    ArrowRight,
    Check,
    Crown,
    Percent,
    Star,
    Zap
} from 'lucide-react'
import { useState } from 'react'

interface PlanUpgradeProps {
  currentSubscription: Subscription | null
  plans: SubscriptionPlan[]
  isLoading: boolean
}

export default function PlanUpgrade({
  currentSubscription,
  plans,
  isLoading
}: PlanUpgradeProps): JSX.Element {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState<{ valid: boolean; discount: number; message?: string } | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)

  const {
    createSubscription,
    updateSubscription,
    validatePromoCode
  } = useBillingStore()

  const getPlanIcon = (type: string) => {
    switch (type) {
      case 'freemium':
        return <Star className="h-5 w-5" />
      case 'premium':
        return <Zap className="h-5 w-5" />
      case 'enterprise':
        return <Crown className="h-5 w-5" />
      default:
        return <Star className="h-5 w-5" />
    }
  }

  const getPlanColor = (type: string) => {
    switch (type) {
      case 'freemium':
        return 'border-gray-200'
      case 'premium':
        return 'border-blue-500 ring-2 ring-blue-200'
      case 'enterprise':
        return 'border-purple-500 ring-2 ring-purple-200'
      default:
        return 'border-gray-200'
    }
  }

  const handleValidatePromoCode = async () => {
    if (!promoCode.trim() || !selectedPlan) return

    setIsValidatingPromo(true)
    try {
      const result = await validatePromoCode(promoCode.trim(), selectedPlan.id)
      setPromoDiscount(result)
    } catch (error) {
      setPromoDiscount({ valid: false, discount: 0, message: 'Invalid promo code' })
    } finally {
      setIsValidatingPromo(false)
    }
  }

  const handleUpgrade = async () => {
    if (!selectedPlan) return

    setIsUpgrading(true)
    try {
      if (currentSubscription) {
        // Update existing subscription
        await updateSubscription(currentSubscription.id, selectedPlan.id)
      } else {
        // Create new subscription
        await createSubscription(
          selectedPlan.id,
          undefined, // Payment method would be handled separately
          promoCode.trim() || undefined
        )
      }
      setSelectedPlan(null)
      setPromoCode('')
      setPromoDiscount(null)
    } catch (error) {
      console.error('Failed to upgrade plan:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  const calculateDiscountedPrice = (price: number) => {
    if (!promoDiscount?.valid) return price

    if (promoDiscount.discount > 1) {
      // Fixed amount discount (in cents)
      return Math.max(0, price - promoDiscount.discount)
    } else {
      // Percentage discount
      return price * (1 - promoDiscount.discount)
    }
  }

  const isCurrentPlan = (plan: SubscriptionPlan) => {
    return currentSubscription?.planId === plan.id
  }

  const canUpgrade = (plan: SubscriptionPlan) => {
    if (!currentSubscription) return true

    const currentPlanIndex = plans.findIndex(p => p.id === currentSubscription.planId)
    const targetPlanIndex = plans.findIndex(p => p.id === plan.id)

    return targetPlanIndex > currentPlanIndex
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-1/3 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose Your Plan</h2>
        <p className="text-muted-foreground mt-2">
          Upgrade or downgrade your subscription at any time
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.filter(plan => plan.isActive).map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${getPlanColor(plan.type)} ${
              isCurrentPlan(plan) ? 'opacity-75' : ''
            }`}
          >
            {plan.type === 'premium' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-500 text-white">Most Popular</Badge>
              </div>
            )}

            {isCurrentPlan(plan) && (
              <div className="absolute -top-3 right-4">
                <Badge variant="secondary">Current Plan</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getPlanIcon(plan.type)}
                {plan.name}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="text-3xl font-bold">
                {plan.price === 0 ? (
                  'Free'
                ) : (
                  <>
                    {formatCurrency(plan.price / 100, plan.currency)}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{plan.billingInterval}
                    </span>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Features */}
              <div className="space-y-2">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">{feature.name}</span>
                      {feature.limit && (
                        <span className="text-muted-foreground"> - {feature.limit}</span>
                      )}
                      {feature.description && (
                        <p className="text-muted-foreground text-xs mt-1">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Limits */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm mb-2">Usage Limits</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Newsletters:</span>
                    <span className="ml-1 font-medium">
                      {plan.limits.newsletters === -1 ? 'Unlimited' : plan.limits.newsletters}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subscribers:</span>
                    <span className="ml-1 font-medium">
                      {plan.limits.subscribers === -1 ? 'Unlimited' : plan.limits.subscribers.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Emails/month:</span>
                    <span className="ml-1 font-medium">
                      {plan.limits.emailsPerMonth === -1 ? 'Unlimited' : plan.limits.emailsPerMonth.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Automations:</span>
                    <span className="ml-1 font-medium">
                      {plan.limits.automations === -1 ? 'Unlimited' : plan.limits.automations}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                {isCurrentPlan(plan) ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full"
                        variant={plan.type === 'premium' ? 'default' : 'outline'}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        {canUpgrade(plan) ? 'Upgrade' : 'Downgrade'} to {plan.name}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {canUpgrade(plan) ? 'Upgrade' : 'Change'} to {plan.name}
                        </DialogTitle>
                        <DialogDescription>
                          {currentSubscription
                            ? `Change your subscription from ${currentSubscription.plan?.name} to ${plan.name}`
                            : `Subscribe to the ${plan.name} plan`
                          }
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {/* Plan Summary */}
                        <div className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{plan.name}</span>
                            <span className="text-lg font-bold">
                              {plan.price === 0 ? 'Free' : formatCurrency(plan.price / 100, plan.currency)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        </div>

                        {/* Promo Code */}
                        {plan.price > 0 && (
                          <div className="space-y-2">
                            <Label htmlFor="promoCode">Promo Code (Optional)</Label>
                            <div className="flex gap-2">
                              <Input
                                id="promoCode"
                                placeholder="Enter promo code"
                                value={promoCode}
                                onChange={(e) => {
                                  setPromoCode(e.target.value)
                                  setPromoDiscount(null)
                                }}
                              />
                              <Button
                                variant="outline"
                                onClick={handleValidatePromoCode}
                                disabled={!promoCode.trim() || isValidatingPromo}
                              >
                                <Percent className="h-4 w-4" />
                              </Button>
                            </div>
                            {promoDiscount && (
                              <div className={`text-sm ${promoDiscount.valid ? 'text-green-600' : 'text-red-600'}`}>
                                {promoDiscount.message || (
                                  promoDiscount.valid
                                    ? `${promoDiscount.discount > 1
                                        ? formatCurrency(promoDiscount.discount / 100, plan.currency)
                                        : `${(promoDiscount.discount * 100).toFixed(0)}%`
                                      } discount applied!`
                                    : 'Invalid promo code'
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Final Price */}
                        {plan.price > 0 && promoDiscount?.valid && (
                          <div className="border rounded-lg p-4 bg-green-50">
                            <div className="flex items-center justify-between">
                              <span>Original Price:</span>
                              <span className="line-through text-muted-foreground">
                                {formatCurrency(plan.price / 100, plan.currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-green-600">
                              <span>Final Price:</span>
                              <span>
                                {formatCurrency(calculateDiscountedPrice(plan.price) / 100, plan.currency)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedPlan(null)
                            setPromoCode('')
                            setPromoDiscount(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleUpgrade}
                          disabled={isUpgrading}
                        >
                          {isUpgrading ? 'Processing...' : 'Confirm'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
